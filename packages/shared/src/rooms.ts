import type { Room, SceneDocument, Vector2, Wall } from "@archvision/types";
import { createId } from "./ids";
import {
  distance2,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
  signedArea,
} from "./geometry2d";

/**
 * Deteccion automatica de habitaciones.
 *
 * Las paredes de un nivel forman un grafo planar. Recorriendo sus caras se
 * obtienen los recintos cerrados sin necesidad de que el usuario dibuje
 * poligonos: cada ciclo minimo en sentido antihorario es una habitacion, y el
 * ciclo exterior (area negativa) se descarta.
 *
 * Los nombres, materiales e identificadores de las habitaciones existentes se
 * conservan emparejando por centroide, de modo que renombrar una sala no se
 * pierde al mover una pared.
 */

/** Tolerancia de union de extremos, en metros. */
const NODE_TOLERANCE = 0.02;
/** Area minima para considerar que un ciclo es una habitacion, en m2. */
const MIN_ROOM_AREA = 0.8;
/** Distancia maxima entre centroides para reutilizar una habitacion previa. */
const MATCH_TOLERANCE = 0.75;

interface HalfEdge {
  from: number;
  to: number;
  angle: number;
  wallId: string;
}

function nodeKey(point: Vector2): string {
  const factor = 1 / NODE_TOLERANCE;
  return `${Math.round(point.x * factor)}:${Math.round(point.y * factor)}`;
}

interface Graph {
  nodes: Vector2[];
  halfEdges: HalfEdge[];
  outgoing: Map<number, number[]>;
}

/** Tramo de pared listo para el grafo: puede ser parte de una pared mayor. */
interface Segment {
  start: Vector2;
  end: Vector2;
  wallId: string;
}

/**
 * Convierte las paredes en un grafo planar.
 *
 * Es imprescindible partir los tramos en las uniones en T y en los cruces:
 * un tabique que muere en mitad de una fachada no comparte extremo con ella,
 * y sin este paso el recorrido de caras nunca cerraria esas habitaciones.
 */
function planarize(walls: readonly Wall[]): Segment[] {
  const inputs: Segment[] = walls
    .map((wall) => ({ start: wall.start, end: wall.end, wallId: wall.id }))
    .filter((segment) => distance2(segment.start, segment.end) > NODE_TOLERANCE);

  const result: Segment[] = [];

  for (let i = 0; i < inputs.length; i += 1) {
    const segment = inputs[i];
    if (!segment) continue;

    const { start, end } = segment;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    const cuts = new Set<number>([0, 1]);

    for (let j = 0; j < inputs.length; j += 1) {
      if (i === j) continue;
      const other = inputs[j];
      if (!other) continue;

      // Union en T: un extremo ajeno apoyado sobre este tramo.
      for (const point of [other.start, other.end]) {
        const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
        if (t <= 0 || t >= 1) continue;
        const projected = { x: start.x + dx * t, y: start.y + dy * t };
        if (distance2(projected, point) <= NODE_TOLERANCE) cuts.add(t);
      }

      // Cruce en X entre dos tramos no paralelos.
      const ox = other.end.x - other.start.x;
      const oy = other.end.y - other.start.y;
      const denominator = dx * oy - dy * ox;
      if (Math.abs(denominator) < 1e-9) continue;

      const t =
        ((other.start.x - start.x) * oy - (other.start.y - start.y) * ox) /
        denominator;
      const u =
        ((other.start.x - start.x) * dy - (other.start.y - start.y) * dx) /
        denominator;

      if (t > 0 && t < 1 && u > 0 && u < 1) cuts.add(t);
    }

    const ordered = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < ordered.length - 1; k += 1) {
      const t0 = ordered[k]!;
      const t1 = ordered[k + 1]!;
      const a = { x: start.x + dx * t0, y: start.y + dy * t0 };
      const b = { x: start.x + dx * t1, y: start.y + dy * t1 };
      if (distance2(a, b) <= NODE_TOLERANCE) continue;
      result.push({ start: a, end: b, wallId: segment.wallId });
    }
  }

  return result;
}

function buildGraph(walls: readonly Wall[]): Graph {
  const indexByKey = new Map<string, number>();
  const nodes: Vector2[] = [];

  const nodeIndex = (point: Vector2): number => {
    const key = nodeKey(point);
    const existing = indexByKey.get(key);
    if (existing !== undefined) return existing;

    const index = nodes.length;
    nodes.push({ x: point.x, y: point.y });
    indexByKey.set(key, index);
    return index;
  };

  const halfEdges: HalfEdge[] = [];
  const seen = new Set<string>();

  for (const wall of planarize(walls)) {
    const a = nodeIndex(wall.start);
    const b = nodeIndex(wall.end);
    if (a === b) continue;

    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pa = nodes[a];
    const pb = nodes[b];
    if (!pa || !pb) continue;

    halfEdges.push({
      from: a,
      to: b,
      angle: Math.atan2(pb.y - pa.y, pb.x - pa.x),
      wallId: wall.wallId,
    });
    halfEdges.push({
      from: b,
      to: a,
      angle: Math.atan2(pa.y - pb.y, pa.x - pb.x),
      wallId: wall.wallId,
    });
  }

  const outgoing = new Map<number, number[]>();
  halfEdges.forEach((edge, index) => {
    const list = outgoing.get(edge.from);
    if (list) list.push(index);
    else outgoing.set(edge.from, [index]);
  });

  for (const list of outgoing.values()) {
    list.sort((left, right) => {
      const a = halfEdges[left];
      const b = halfEdges[right];
      return (a?.angle ?? 0) - (b?.angle ?? 0);
    });
  }

  return { nodes, halfEdges, outgoing };
}

export interface DetectedRoom {
  polygon: Vector2[];
  wallIds: string[];
  area: number;
  perimeter: number;
  centroid: Vector2;
}

/** Ciclos minimos cerrados formados por las paredes de un nivel. */
export function detectRoomPolygons(walls: readonly Wall[]): DetectedRoom[] {
  const graph = buildGraph(walls);
  if (graph.halfEdges.length === 0) return [];

  const visited = new Set<number>();
  const rooms: DetectedRoom[] = [];

  for (let start = 0; start < graph.halfEdges.length; start += 1) {
    if (visited.has(start)) continue;

    const polygonIndices: number[] = [];
    const wallIds: string[] = [];
    let current = start;
    let guard = 0;

    while (!visited.has(current) && guard < graph.halfEdges.length * 2) {
      guard += 1;
      visited.add(current);

      const edge = graph.halfEdges[current];
      if (!edge) break;

      polygonIndices.push(edge.from);
      wallIds.push(edge.wallId);

      // Siguiente arista: en el nodo destino, la inmediatamente anterior en
      // orden antihorario a la arista de vuelta. Ese giro maximo a la derecha
      // es lo que cierra las caras interiores.
      const list = graph.outgoing.get(edge.to);
      if (!list || list.length === 0) break;

      const reverseIndex = list.findIndex((index) => {
        const candidate = graph.halfEdges[index];
        return candidate?.to === edge.from && candidate?.wallId === edge.wallId;
      });
      if (reverseIndex === -1) break;

      const nextIndex = list[(reverseIndex - 1 + list.length) % list.length];
      if (nextIndex === undefined) break;
      current = nextIndex;

      if (current === start) break;
    }

    if (polygonIndices.length < 3) continue;

    const polygon = polygonIndices
      .map((index) => graph.nodes[index])
      .filter((point): point is Vector2 => point !== undefined);

    if (polygon.length < 3) continue;

    // Solo las caras interiores tienen area con signo positivo.
    if (signedArea(polygon) <= 0) continue;

    const area = polygonArea(polygon);
    if (area < MIN_ROOM_AREA) continue;

    rooms.push({
      polygon,
      wallIds: Array.from(new Set(wallIds)),
      area,
      perimeter: polygonPerimeter(polygon),
      centroid: polygonCentroid(polygon),
    });
  }

  return rooms;
}

/**
 * Recalcula las habitaciones de toda la escena conservando nombres y
 * materiales de las anteriores.
 */
export function recomputeRooms(scene: SceneDocument): Room[] {
  const result: Room[] = [];

  for (const floor of scene.floors) {
    const walls = scene.walls.filter(
      (wall) => wall.floorId === floor.id && wall.visible !== false,
    );
    const detected = detectRoomPolygons(walls);
    const previous = scene.rooms.filter((room) => room.floorId === floor.id);
    const used = new Set<string>();

    detected.forEach((room, index) => {
      const match = previous.find((candidate) => {
        if (used.has(candidate.id)) return false;
        const centroid = polygonCentroid(candidate.polygon);
        return distance2(centroid, room.centroid) <= MATCH_TOLERANCE;
      });

      if (match) used.add(match.id);

      result.push({
        id: match?.id ?? createId(),
        floorId: floor.id,
        name: match?.name ?? `Espacio ${index + 1}`,
        polygon: room.polygon,
        wallIds: room.wallIds,
        area: Math.round(room.area * 1000) / 1000,
        perimeter: Math.round(room.perimeter * 1000) / 1000,
        ...(match?.floorMaterialId ? { floorMaterialId: match.floorMaterialId } : {}),
        ...(match?.ceilingMaterialId
          ? { ceilingMaterialId: match.ceilingMaterialId }
          : {}),
        ...(match?.color ? { color: match.color } : {}),
      });
    });
  }

  return result;
}

/** Escena con las habitaciones actualizadas tras un cambio estructural. */
export function withRecomputedRooms(scene: SceneDocument): SceneDocument {
  return { ...scene, rooms: recomputeRooms(scene) };
}
