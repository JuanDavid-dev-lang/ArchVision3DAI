import type { Vector2, Wall } from "@archvision/types";
import { distance2, projectOnSegment, snapTo } from "@archvision/shared";

/**
 * Snapping inteligente del editor.
 *
 * Prioridad descendente: extremo de pared, punto medio, proyeccion sobre el
 * eje de una pared, alineacion ortogonal con el punto de referencia y, por
 * ultimo, cuadricula. Los umbrales se expresan en metros de mundo; el editor
 * los calcula a partir de un umbral en pixeles y de la escala actual, de modo
 * que el comportamiento es estable a cualquier zoom.
 */

export type SnapKind =
  | "endpoint"
  | "midpoint"
  | "wall"
  | "axis"
  | "grid"
  | "free";

export interface SnapResult {
  point: Vector2;
  kind: SnapKind;
  /** Identificador de la entidad implicada, cuando aplica. */
  targetId?: string;
  /** Distancia a lo largo de la pared, util para colocar vanos. */
  distanceAlong?: number;
}

export interface SnapOptions {
  walls: readonly Wall[];
  /** Paso de la cuadricula en metros. 0 desactiva el ajuste a rejilla. */
  gridStep: number;
  /** Radio de captura en metros. */
  threshold: number;
  /** Punto anterior, para forzar horizontal y vertical. */
  reference?: Vector2 | null;
  enable?: Partial<Record<SnapKind, boolean>>;
}

const DEFAULT_ENABLED: Record<SnapKind, boolean> = {
  endpoint: true,
  midpoint: true,
  wall: true,
  axis: true,
  grid: true,
  free: true,
};

/** Ajusta un punto del plano segun las reglas activas. */
export function snapPoint(point: Vector2, options: SnapOptions): SnapResult {
  const enabled = { ...DEFAULT_ENABLED, ...options.enable };
  const threshold = options.threshold;

  if (enabled.endpoint) {
    let best: SnapResult | null = null;
    let bestDistance = threshold;

    for (const wall of options.walls) {
      for (const [candidate, label] of [
        [wall.start, "start"],
        [wall.end, "end"],
      ] as const) {
        const distance = distance2(point, candidate);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = {
            point: { x: candidate.x, y: candidate.y },
            kind: "endpoint",
            targetId: `${wall.id}:${label}`,
          };
        }
      }
    }
    if (best) return best;
  }

  if (enabled.midpoint) {
    let best: SnapResult | null = null;
    let bestDistance = threshold;

    for (const wall of options.walls) {
      const middle = {
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2,
      };
      const distance = distance2(point, middle);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { point: middle, kind: "midpoint", targetId: wall.id };
      }
    }
    if (best) return best;
  }

  if (enabled.wall) {
    let best: SnapResult | null = null;
    let bestDistance = threshold;

    for (const wall of options.walls) {
      const projection = projectOnSegment(point, wall.start, wall.end);
      if (projection.distanceTo < bestDistance) {
        bestDistance = projection.distanceTo;
        best = {
          point: projection.point,
          kind: "wall",
          targetId: wall.id,
          distanceAlong: projection.distanceAlong,
        };
      }
    }
    if (best) return best;
  }

  if (enabled.axis && options.reference) {
    const reference = options.reference;
    const dx = Math.abs(point.x - reference.x);
    const dy = Math.abs(point.y - reference.y);

    if (dx < threshold && dx <= dy) {
      const snapped = enabled.grid
        ? { x: reference.x, y: snapTo(point.y, options.gridStep) }
        : { x: reference.x, y: point.y };
      return { point: snapped, kind: "axis" };
    }
    if (dy < threshold) {
      const snapped = enabled.grid
        ? { x: snapTo(point.x, options.gridStep), y: reference.y }
        : { x: point.x, y: reference.y };
      return { point: snapped, kind: "axis" };
    }
  }

  if (enabled.grid && options.gridStep > 0) {
    return {
      point: {
        x: snapTo(point.x, options.gridStep),
        y: snapTo(point.y, options.gridStep),
      },
      kind: "grid",
    };
  }

  return { point, kind: "free" };
}

/**
 * Busca la pared mas cercana a un punto, para colocar puertas y ventanas.
 * Devuelve tambien la distancia desde el inicio de la pared, que es
 * exactamente el `offset` que espera la entidad del vano.
 */
export function findWallAt(
  point: Vector2,
  walls: readonly Wall[],
  threshold: number,
): { wall: Wall; offset: number; distance: number } | null {
  let best: { wall: Wall; offset: number; distance: number } | null = null;

  for (const wall of walls) {
    const projection = projectOnSegment(point, wall.start, wall.end);
    const reach = threshold + wall.thickness / 2;
    if (projection.distanceTo > reach) continue;
    if (best && projection.distanceTo >= best.distance) continue;

    best = {
      wall,
      offset: projection.distanceAlong,
      distance: projection.distanceTo,
    };
  }

  return best;
}
