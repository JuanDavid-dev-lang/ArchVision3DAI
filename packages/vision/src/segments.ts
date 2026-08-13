import { isInk, type BinaryImage } from "./image";
import type { HoughLine } from "./hough";

/**
 * De recta infinita a tramo real.
 *
 * Hough dice "aqui hay una recta" pero no donde empieza ni donde acaba. Se
 * recorre la recta paso a paso comprobando si hay tinta en una banda estrecha
 * a su alrededor: los tramos con tinta continua son los muros, y los huecos
 * largos son puertas, ventanas o simplemente el final del muro.
 */

export interface PixelSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Longitud en pixeles. */
  length: number;
  /** Grosor medio del trazo, en pixeles. */
  thickness: number;
  /** Proporcion del recorrido con tinta, 0 a 1. */
  coverage: number;
}

export interface TraceOptions {
  /** Semiancho de la banda de busqueda, en pixeles. */
  band: number;
  /** Hueco maximo tolerado dentro de un mismo tramo, en pixeles. */
  maxGap: number;
  /** Longitud minima de un tramo aceptado, en pixeles. */
  minLength: number;
}

export const DEFAULT_TRACE: TraceOptions = {
  band: 6,
  maxGap: 6,
  minLength: 24,
};

/** Grosor de trazo alrededor de un punto, medido en perpendicular. */
function measureThickness(
  mask: BinaryImage,
  x: number,
  y: number,
  nx: number,
  ny: number,
  band: number,
): number {
  let thickness = 0;

  for (let side = -1; side <= 1; side += 2) {
    for (let step = side === -1 ? 0 : 1; step <= band; step += 1) {
      const px = Math.round(x + nx * step * side);
      const py = Math.round(y + ny * step * side);
      if (!isInk(mask, px, py)) break;
      thickness += 1;
    }
  }

  return thickness;
}

/**
 * Extrae los tramos con tinta a lo largo de una recta de Hough.
 *
 * La recta se parametriza como `p(t) = rho * n + t * d`, con `n` la normal y
 * `d` la direccion; recorrer `t` de uno en uno equivale a avanzar un pixel.
 */
export function traceSegments(
  mask: BinaryImage,
  line: HoughLine,
  options: TraceOptions = DEFAULT_TRACE,
): PixelSegment[] {
  const nx = Math.cos(line.theta);
  const ny = Math.sin(line.theta);
  const dx = -ny;
  const dy = nx;

  const originX = line.rho * nx;
  const originY = line.rho * ny;

  // Rango de t que mantiene el punto dentro de la imagen: se acota por la
  // diagonal, que siempre lo cubre, y se descartan los pasos que caen fuera.
  const limit = Math.ceil(Math.hypot(mask.width, mask.height));

  const segments: PixelSegment[] = [];

  let startT: number | null = null;
  let lastInkT: number | null = null;
  let inkSteps = 0;
  let thicknessSum = 0;
  let thicknessCount = 0;

  const flush = (endT: number) => {
    if (startT === null) return;

    const length = endT - startT;
    if (length >= options.minLength) {
      segments.push({
        x1: originX + dx * startT,
        y1: originY + dy * startT,
        x2: originX + dx * endT,
        y2: originY + dy * endT,
        length,
        thickness: thicknessCount > 0 ? thicknessSum / thicknessCount : 1,
        coverage: length > 0 ? Math.min(1, inkSteps / length) : 0,
      });
    }

    startT = null;
    lastInkT = null;
    inkSteps = 0;
    thicknessSum = 0;
    thicknessCount = 0;
  };

  for (let t = -limit; t <= limit; t += 1) {
    const x = originX + dx * t;
    const y = originY + dy * t;

    if (x < -options.band || y < -options.band) continue;
    if (x > mask.width + options.band || y > mask.height + options.band) continue;

    let hit = false;
    for (let offset = -options.band; offset <= options.band && !hit; offset += 1) {
      const px = Math.round(x + nx * offset);
      const py = Math.round(y + ny * offset);
      if (isInk(mask, px, py)) hit = true;
    }

    if (hit) {
      if (startT === null) startT = t;
      lastInkT = t;
      inkSteps += 1;

      const thickness = measureThickness(mask, x, y, nx, ny, options.band);
      if (thickness > 0) {
        thicknessSum += thickness;
        thicknessCount += 1;
      }
    } else if (lastInkT !== null && t - lastInkT > options.maxGap) {
      flush(lastInkT);
    }
  }

  if (lastInkT !== null) flush(lastInkT);

  return segments;
}

function pointDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Une tramos casi colineales y solapados.
 *
 * Dos maximos vecinos del acumulador pueden describir el mismo muro con un
 * grado de diferencia; sin esta fusion el resultado tendria paredes dobles.
 */
export function mergeSegments(
  segments: readonly PixelSegment[],
  tolerance: number,
): PixelSegment[] {
  const result: PixelSegment[] = [];

  for (const segment of segments) {
    let merged = false;

    for (let i = 0; i < result.length; i += 1) {
      const other = result[i];
      if (!other) continue;

      const sameDirection =
        Math.abs(
          Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) -
            Math.atan2(other.y2 - other.y1, other.x2 - other.x1),
        ) % Math.PI;
      const angleClose = sameDirection < 0.09 || Math.PI - sameDirection < 0.09;
      if (!angleClose) continue;

      const endpointsClose =
        Math.min(
          pointDistance(segment.x1, segment.y1, other.x1, other.y1),
          pointDistance(segment.x1, segment.y1, other.x2, other.y2),
          pointDistance(segment.x2, segment.y2, other.x1, other.y1),
          pointDistance(segment.x2, segment.y2, other.x2, other.y2),
        ) <= tolerance;
      if (!endpointsClose) continue;

      // Se conserva el par de extremos mas separado de los cuatro.
      const points = [
        [segment.x1, segment.y1],
        [segment.x2, segment.y2],
        [other.x1, other.y1],
        [other.x2, other.y2],
      ] as const;

      let bestLength = -1;
      let best: [number, number, number, number] = [
        other.x1,
        other.y1,
        other.x2,
        other.y2,
      ];

      for (let a = 0; a < points.length; a += 1) {
        for (let b = a + 1; b < points.length; b += 1) {
          const pa = points[a]!;
          const pb = points[b]!;
          const length = pointDistance(pa[0]!, pa[1]!, pb[0]!, pb[1]!);
          if (length > bestLength) {
            bestLength = length;
            best = [pa[0]!, pa[1]!, pb[0]!, pb[1]!];
          }
        }
      }

      const weight = segment.length + other.length;
      result[i] = {
        x1: best[0],
        y1: best[1],
        x2: best[2],
        y2: best[3],
        length: bestLength,
        thickness:
          (segment.thickness * segment.length + other.thickness * other.length) / weight,
        coverage:
          (segment.coverage * segment.length + other.coverage * other.length) / weight,
      };
      merged = true;
      break;
    }

    if (!merged) result.push({ ...segment });
  }

  return result;
}
