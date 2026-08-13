import type { SceneDocument, SceneMetrics, UnitSystem } from "@archvision/types";
import {
  computeSceneMetrics,
  distance2,
  formatArea,
  formatLength,
} from "@archvision/shared";
import type { AssistantContext } from "./types";

/**
 * Conciencia del proyecto.
 *
 * El asistente no puede recorrer la escena entera en cada respuesta: un modelo
 * mediano tiene miles de entidades y el texto se dispararia. Aqui se resume la
 * escena a una ficha de tamano acotado que responde a las preguntas que de
 * verdad se hacen: cuanto mide, que hay en cada nivel, que falta.
 *
 * La ficha es tambien lo que se envia al modelo de lenguaje, de modo que el
 * limite de tamano es una decision de coste, no solo de legibilidad.
 */

export interface FloorDigest {
  id: string;
  name: string;
  level: number;
  height: number;
  walls: number;
  doors: number;
  windows: number;
  columns: number;
  stairs: number;
  roofs: number;
  furniture: number;
  rooms: { id: string; name: string; area: number }[];
  /** Suma de longitudes de muro, en metros. */
  wallLength: number;
}

export interface SceneDigest {
  projectName: string;
  displayUnit: UnitSystem;
  metrics: SceneMetrics;
  floors: FloorDigest[];
  activeFloorId: string | null;
  materials: { total: number; used: number; names: string[] };
  hasUnderlay: boolean;
  /** Descripcion corta de lo seleccionado, si hay seleccion. */
  selection: string | null;
  empty: boolean;
}

/** Cuantas habitaciones se enumeran por nivel antes de resumir. */
const MAX_ROOMS_PER_FLOOR = 12;
/** Cuantos materiales se nombran en la ficha. */
const MAX_MATERIAL_NAMES = 10;

function describeSelection(
  scene: SceneDocument,
  selection: readonly string[],
): string | null {
  if (selection.length === 0) return null;
  if (selection.length > 1) return `${selection.length} objetos seleccionados`;

  const id = selection[0];
  if (!id) return null;

  const wall = scene.walls.find((item) => item.id === id);
  if (wall) {
    const length = distance2(wall.start, wall.end);
    return `muro "${wall.name}" de ${length.toFixed(2)} m por ${wall.height.toFixed(2)} m de alto y ${(wall.thickness * 100).toFixed(0)} cm de grosor`;
  }

  const door = scene.doors.find((item) => item.id === id);
  if (door) {
    return `puerta "${door.name}" de ${door.width.toFixed(2)} x ${door.height.toFixed(2)} m`;
  }

  const window = scene.windows.find((item) => item.id === id);
  if (window) {
    return `ventana "${window.name}" de ${window.width.toFixed(2)} x ${window.height.toFixed(2)} m, antepecho a ${window.sillHeight.toFixed(2)} m`;
  }

  const room = scene.rooms.find((item) => item.id === id);
  if (room) {
    return `habitacion "${room.name}" de ${room.area.toFixed(2)} m2`;
  }

  const piece = scene.furniture.find((item) => item.id === id);
  if (piece) return `mobiliario "${piece.name}"`;

  const column = scene.columns.find((item) => item.id === id);
  if (column) return `columna "${column.name}"`;

  const stair = scene.stairs.find((item) => item.id === id);
  if (stair) return `escalera "${stair.name}"`;

  const roof = scene.roofs.find((item) => item.id === id);
  if (roof) return `cubierta "${roof.name}"`;

  return "1 objeto seleccionado";
}

/** Materiales realmente asignados a alguna entidad. */
function usedMaterialIds(scene: SceneDocument): Set<string> {
  const used = new Set<string>();
  const add = (id: string | undefined) => {
    if (id) used.add(id);
  };

  for (const wall of scene.walls) {
    add(wall.materialInteriorId);
    add(wall.materialExteriorId);
  }
  for (const room of scene.rooms) {
    add(room.floorMaterialId);
    add(room.ceilingMaterialId);
  }
  for (const roof of scene.roofs) add(roof.materialId);
  for (const slab of scene.slabs) add(slab.materialId);
  for (const column of scene.columns) add(column.materialId);
  for (const stair of scene.stairs) add(stair.materialId);
  for (const piece of scene.furniture) {
    for (const id of Object.values(piece.materialOverrides ?? {})) add(id);
  }

  return used;
}

export function buildSceneDigest(
  scene: SceneDocument,
  context: AssistantContext,
): SceneDigest {
  const floors: FloorDigest[] = scene.floors.map((floor) => {
    const walls = scene.walls.filter((wall) => wall.floorId === floor.id);
    const rooms = scene.rooms
      .filter((room) => room.floorId === floor.id)
      .map((room) => ({ id: room.id, name: room.name, area: room.area }));

    return {
      id: floor.id,
      name: floor.name,
      level: floor.level,
      height: floor.height,
      walls: walls.length,
      doors: scene.doors.filter((item) => item.floorId === floor.id).length,
      windows: scene.windows.filter((item) => item.floorId === floor.id).length,
      columns: scene.columns.filter((item) => item.floorId === floor.id).length,
      stairs: scene.stairs.filter((item) => item.floorId === floor.id).length,
      roofs: scene.roofs.filter((item) => item.floorId === floor.id).length,
      furniture: scene.furniture.filter((item) => item.floorId === floor.id)
        .length,
      rooms,
      wallLength: walls.reduce(
        (total, wall) => total + distance2(wall.start, wall.end),
        0,
      ),
    };
  });

  const used = usedMaterialIds(scene);
  const names = scene.materials
    .filter((material) => used.has(material.id))
    .map((material) => material.name)
    .slice(0, MAX_MATERIAL_NAMES);

  return {
    projectName: context.projectName,
    displayUnit: (context.displayUnit as UnitSystem) ?? scene.displayUnit ?? "m",
    metrics: computeSceneMetrics(scene),
    floors,
    activeFloorId: context.activeFloorId,
    materials: { total: scene.materials.length, used: used.size, names },
    hasUnderlay: Boolean(scene.underlay),
    selection: describeSelection(scene, context.selection),
    empty: scene.walls.length === 0 && scene.furniture.length === 0,
  };
}

/**
 * Convierte la ficha en texto.
 *
 * Se usa en dos sitios: como contexto del modelo de lenguaje y como respuesta
 * directa cuando el usuario pregunta por el estado del proyecto. Que sea el
 * mismo texto evita que el asistente diga una cosa y el panel muestre otra.
 */
export function renderSceneDigest(digest: SceneDigest): string {
  const unit = digest.displayUnit;
  const lines: string[] = [];

  lines.push(`Proyecto: ${digest.projectName}`);

  if (digest.empty) {
    lines.push("El modelo esta vacio: todavia no hay muros ni mobiliario.");
    return lines.join("\n");
  }

  const m = digest.metrics;
  lines.push(
    `Area util ${formatArea(m.usableArea, unit)} en ${m.roomCount} habitacion(es); ` +
      `superficie de muro ${formatArea(m.wallSurface, unit)}; ` +
      `${m.doorCount} puerta(s) y ${m.windowCount} ventana(s); ` +
      `volumen ${m.volume.toFixed(1)} m3.`,
  );

  for (const floor of digest.floors) {
    const parts = [
      `${floor.walls} muros (${formatLength(floor.wallLength, unit)} en total)`,
      `${floor.doors} puertas`,
      `${floor.windows} ventanas`,
    ];
    if (floor.columns > 0) parts.push(`${floor.columns} columnas`);
    if (floor.stairs > 0) parts.push(`${floor.stairs} escaleras`);
    if (floor.roofs > 0) parts.push(`${floor.roofs} cubiertas`);
    if (floor.furniture > 0) parts.push(`${floor.furniture} muebles`);

    const active = floor.id === digest.activeFloorId ? " (nivel activo)" : "";
    lines.push(
      `Nivel "${floor.name}"${active}, altura libre ${formatLength(floor.height, unit)}: ${parts.join(", ")}.`,
    );

    if (floor.rooms.length > 0) {
      const shown = floor.rooms.slice(0, MAX_ROOMS_PER_FLOOR);
      const rest = floor.rooms.length - shown.length;
      const detail = shown
        .map((room) => `${room.name} ${room.area.toFixed(1)} m2`)
        .join("; ");
      lines.push(
        `  Habitaciones: ${detail}${rest > 0 ? ` y ${rest} mas` : ""}.`,
      );
    }
  }

  lines.push(
    `Materiales: ${digest.materials.used} en uso de ${digest.materials.total} disponibles` +
      (digest.materials.names.length > 0
        ? ` (${digest.materials.names.join(", ")}).`
        : "."),
  );

  if (digest.hasUnderlay) lines.push("Hay un plano de referencia colocado.");
  if (digest.selection) lines.push(`Seleccion actual: ${digest.selection}.`);

  return lines.join("\n");
}
