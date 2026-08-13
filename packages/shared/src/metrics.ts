import type { SceneDocument, SceneMetrics } from "@archvision/types";
import { distance2, polygonArea } from "./geometry2d";

/**
 * Analitica arquitectonica derivada de la escena.
 *
 * Calculo aproximado y no certificado: sirve para estimacion de cantidades y
 * para el panel de analitica, nunca como calculo estructural.
 */
export function computeSceneMetrics(scene: SceneDocument): SceneMetrics {
  const wallSurface = scene.walls.reduce((total, wall) => {
    const length = distance2(wall.start, wall.end);
    return total + length * wall.height;
  }, 0);

  const openingSurface = [
    ...scene.doors.map((d) => d.width * d.height),
    ...scene.windows.map((w) => w.width * w.height),
    ...scene.openings.map((o) => o.width * o.height),
  ].reduce((total, area) => total + area, 0);

  const glazedSurface = scene.windows.reduce(
    (total, w) => total + w.width * w.height,
    0,
  );

  const usableArea = scene.rooms.reduce((total, room) => total + room.area, 0);
  const builtArea = scene.slabs.reduce(
    (total, slab) => total + polygonArea(slab.outline),
    0,
  );
  const roofSurface = scene.roofs.reduce((total, roof) => {
    const flat = polygonArea(roof.outline);
    const slopeFactor = 1 / Math.cos((roof.slopeDeg * Math.PI) / 180 || 0);
    return total + flat * (Number.isFinite(slopeFactor) ? slopeFactor : 1);
  }, 0);

  const volume = scene.rooms.reduce((total, room) => {
    const floor = scene.floors.find((f) => f.id === room.floorId);
    return total + room.area * (floor?.height ?? 0);
  }, 0);

  return {
    builtArea,
    usableArea,
    wallSurface: Math.max(0, wallSurface - openingSurface),
    floorSurface: usableArea > 0 ? usableArea : builtArea,
    roofSurface,
    glazedSurface,
    volume,
    roomCount: scene.rooms.length,
    doorCount: scene.doors.length,
    windowCount: scene.windows.length,
  };
}
