import type { Vector2 } from "@archvision/types";

/** Utilidades geometricas 2D puras (sin dependencias de Three.js). */

export function distance2(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function midpoint2(a: Vector2, b: Vector2): Vector2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Angulo del segmento a->b en radianes, medido desde el eje +X. */
export function angleOf(a: Vector2, b: Vector2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Vector unitario a->b. Devuelve {0,0} si los puntos coinciden. */
export function direction2(a: Vector2, b: Vector2): Vector2 {
  const length = distance2(a, b);
  if (length === 0) return { x: 0, y: 0 };
  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
}

/** Normal izquierda del segmento a->b (rotacion +90 grados). */
export function normal2(a: Vector2, b: Vector2): Vector2 {
  const d = direction2(a, b);
  return { x: -d.y, y: d.x };
}

/** Area con signo del poligono (positiva en sentido antihorario). */
export function signedArea(points: readonly Vector2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) continue;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function polygonArea(points: readonly Vector2[]): number {
  return Math.abs(signedArea(points));
}

export function polygonPerimeter(points: readonly Vector2[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) continue;
    total += distance2(current, next);
  }
  return total;
}

export function polygonCentroid(points: readonly Vector2[]): Vector2 {
  const area = signedArea(points);
  if (points.length === 0) return { x: 0, y: 0 };
  if (area === 0) {
    // Poligono degenerado: promedio simple.
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) continue;
    const cross = current.x * next.y - next.x * current.y;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/** Proyeccion escalar de `point` sobre el segmento a->b, en metros desde `a`. */
export function projectOnSegment(
  point: Vector2,
  a: Vector2,
  b: Vector2,
): { t: number; distanceAlong: number; distanceTo: number; point: Vector2 } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) {
    return { t: 0, distanceAlong: 0, distanceTo: distance2(point, a), point: a };
  }
  const rawT = ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq;
  const t = Math.min(1, Math.max(0, rawT));
  const projected = { x: a.x + abx * t, y: a.y + aby * t };
  return {
    t,
    distanceAlong: t * Math.sqrt(lengthSq),
    distanceTo: distance2(point, projected),
    point: projected,
  };
}

/** Punto dentro de poligono (ray casting). */
export function pointInPolygon(
  point: Vector2,
  polygon: readonly Vector2[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
