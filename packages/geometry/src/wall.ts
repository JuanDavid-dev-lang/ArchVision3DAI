import {
  BufferGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
} from "three";
import type { Door, Opening, Wall, WindowEntity } from "@archvision/types";
import { distance2 } from "@archvision/shared";
import { applyBoxUv } from "./uv";

/**
 * Geometria de paredes.
 *
 * La pared se construye en coordenadas locales: el eje X recorre su longitud,
 * el eje Y su altura y el eje Z su grosor. Los vanos son agujeros del perfil,
 * de modo que la extrusion los abre sin necesidad de operaciones booleanas.
 *
 * El objeto resultante se coloca con `wallTransform`, que devuelve la posicion
 * del punto inicial y la rotacion alrededor de Y.
 */

export interface WallOpening {
  id: string;
  /** Distancia en metros desde `wall.start` al centro del vano. */
  offset: number;
  width: number;
  height: number;
  /** Altura del antepecho. Las puertas usan 0. */
  sillHeight: number;
}

export interface WallTransform {
  position: [number, number, number];
  rotationY: number;
  length: number;
}

/** Longitud del eje de la pared. */
export function wallLength(wall: Pick<Wall, "start" | "end">): number {
  return distance2(wall.start, wall.end);
}

/**
 * Posicion y rotacion de la pared en el mundo.
 *
 * El plano de planta usa (x, y); en el mundo 3D esa `y` es la coordenada Z.
 * Rotar un vector unitario +X alrededor de Y un angulo `a` da (cos a, 0, -sin a),
 * por lo que la rotacion necesaria es `-atan2(dy, dx)`.
 */
export function wallTransform(wall: Wall, floorElevation: number): WallTransform {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;

  return {
    position: [wall.start.x, floorElevation + wall.baseOffset, wall.start.y],
    rotationY: -Math.atan2(dy, dx),
    length: Math.hypot(dx, dy),
  };
}

/** Convierte puertas y ventanas de una pared al formato de vano generico. */
export function collectWallOpenings(
  wallId: string,
  doors: readonly Door[],
  windows: readonly WindowEntity[],
  openings: readonly Opening[] = [],
): WallOpening[] {
  const result: WallOpening[] = [];

  for (const door of doors) {
    if (door.wallId !== wallId) continue;
    result.push({
      id: door.id,
      offset: door.offset,
      width: door.width,
      height: door.height,
      sillHeight: 0,
    });
  }

  for (const window of windows) {
    if (window.wallId !== wallId) continue;
    result.push({
      id: window.id,
      offset: window.offset,
      width: window.width,
      height: window.height,
      sillHeight: window.sillHeight,
    });
  }

  for (const opening of openings) {
    if (opening.wallId !== wallId) continue;
    result.push({
      id: opening.id,
      offset: opening.offset,
      width: opening.width,
      height: opening.height,
      sillHeight: opening.sillHeight,
    });
  }

  return result;
}

const MIN_MARGIN = 0.01;

/**
 * Recorta un vano para que quede dentro de la pared.
 * Devuelve null cuando el vano no cabe: la geometria lo ignora en lugar de
 * generar un perfil invalido.
 */
export function clampOpening(
  opening: WallOpening,
  length: number,
  height: number,
): { u0: number; u1: number; v0: number; v1: number } | null {
  const halfWidth = opening.width / 2;
  const u0 = Math.max(MIN_MARGIN, opening.offset - halfWidth);
  const u1 = Math.min(length - MIN_MARGIN, opening.offset + halfWidth);
  const v0 = Math.max(0, opening.sillHeight);
  const v1 = Math.min(height - MIN_MARGIN, opening.sillHeight + opening.height);

  if (u1 - u0 < MIN_MARGIN) return null;
  if (v1 - v0 < MIN_MARGIN) return null;

  return { u0, u1, v0, v1 };
}

/**
 * Genera la geometria de una pared con sus vanos.
 * Coordenadas locales: X = longitud, Y = altura, Z = grosor centrado en el eje.
 */
export function createWallGeometry(
  wall: Wall,
  openings: readonly WallOpening[] = [],
): BufferGeometry {
  const length = wallLength(wall);
  const height = wall.height;

  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.lineTo(0, height);
  shape.closePath();

  for (const opening of openings) {
    const box = clampOpening(opening, length, height);
    if (!box) continue;

    const hole = new Path();
    hole.moveTo(box.u0, box.v0);
    hole.lineTo(box.u0, box.v1);
    hole.lineTo(box.u1, box.v1);
    hole.lineTo(box.u1, box.v0);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new ExtrudeGeometry(shape, {
    depth: wall.thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });

  // La extrusion crece hacia +Z; se centra sobre el eje de la pared.
  geometry.translate(0, 0, -wall.thickness / 2);
  geometry.computeVertexNormals();
  // Las UV del extrusor estan en el sistema del perfil; se sustituyen por una
  // proyeccion en metros para que las texturas midan lo mismo en toda la casa.
  applyBoxUv(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Firma de la pared para memoizar geometria: solo cambia cuando cambia algo
 * que afecta a la forma. Evita regenerar mallas al mover la camara o al
 * cambiar materiales.
 */
export function wallGeometryKey(
  wall: Wall,
  openings: readonly WallOpening[],
): string {
  const openingKey = openings
    .map((o) => `${o.id}:${o.offset}:${o.width}:${o.height}:${o.sillHeight}`)
    .sort()
    .join("|");

  return [
    wall.id,
    wallLength(wall).toFixed(4),
    wall.height.toFixed(4),
    wall.thickness.toFixed(4),
    openingKey,
  ].join("#");
}
