import type { TexturePattern } from "@archvision/types";
import { clamp01, fbm, hashString, mix, mulberry32 } from "./noise";

/**
 * Definicion matematica de cada patron de textura.
 *
 * Cada patron devuelve tres campos por pixel:
 *
 * - `shade`     multiplicador sobre el color base del material (1 = sin cambio).
 * - `height`    altura del relieve, 0 a 1, de la que se deriva el mapa normal.
 * - `roughness` multiplicador sobre la rugosidad del material.
 *
 * Trabajar con multiplicadores y no con colores absolutos permite generar la
 * textura una sola vez por patron y reutilizarla con cualquier color base: el
 * ladrillo rojo y el blanqueado comparten imagen y solo cambian de tinte.
 */

export interface PatternSample {
  shade: number;
  height: number;
  roughness: number;
}

export type PatternFunction = (u: number, v: number) => PatternSample;

function frac(value: number): number {
  return value - Math.floor(value);
}

/** Indice de celda dentro del periodo, para que la ultima empalme con la primera. */
function wrap(index: number, period: number): number {
  return ((index % period) + period) % period;
}

/** Valor pseudoaleatorio estable para una celda entera. */
function cellRandom(x: number, y: number, seed: number): number {
  const hash = Math.imul(x * 73856093, 1) ^ Math.imul(y * 19349663, 1) ^ seed;
  return mulberry32(hash >>> 0)();
}

/** Bandas de mortero suavizadas en los bordes de cada pieza. */
function jointFactor(local: number, joint: number): number {
  const distance = Math.min(local, 1 - local);
  if (distance >= joint) return 1;
  return clamp01(distance / joint);
}

function masonry(options: {
  cols: number;
  rows: number;
  joint: number;
  stagger: boolean;
  seed: number;
  toneRange: number;
  grain: (u: number, v: number) => number;
}): PatternFunction {
  const { cols, rows, joint, stagger, seed, toneRange, grain } = options;

  // Con hiladas alternas, el numero de filas debe ser par: si no, la ultima y
  // la primera llevarian el mismo desplazamiento y el aparejo se rompe al
  // repetir la textura.
  const rowCount = stagger && rows % 2 !== 0 ? rows + 1 : rows;

  return (u, v) => {
    const rowIndex = wrap(Math.floor(v * rowCount), rowCount);
    const shift = stagger && rowIndex % 2 !== 0 ? 0.5 : 0;
    const uu = u * cols + shift;
    const colIndex = wrap(Math.floor(uu), cols);

    const localU = frac(uu);
    const localV = frac(v * rowCount);

    const edge = Math.min(jointFactor(localU, joint), jointFactor(localV, joint));
    const tone = cellRandom(colIndex, rowIndex, seed);
    const noise = grain(u, v);

    // Pieza: tono propio por unidad mas grano fino.
    const brickShade = 1 + (tone - 0.5) * toneRange + (noise - 0.5) * 0.12;
    const brickHeight = 0.75 + noise * 0.25;

    // Junta: mas oscura, hundida y siempre mate.
    const jointShade = 0.68 + noise * 0.08;

    return {
      shade: mix(jointShade, brickShade, edge),
      height: mix(0.1, brickHeight, edge),
      roughness: mix(1.05, 0.92 + noise * 0.1, edge),
    };
  };
}

function createPattern(pattern: TexturePattern): PatternFunction {
  const seed = hashString(pattern);
  const fine = fbm({ baseFrequency: 32, octaves: 4, persistence: 0.55, seed });
  const coarse = fbm({ baseFrequency: 4, octaves: 4, persistence: 0.6, seed: seed + 101 });

  switch (pattern) {
    case "plain":
      return () => ({ shade: 1, height: 0.5, roughness: 1 });

    case "brick":
      return masonry({
        cols: 4,
        rows: 8,
        joint: 0.07,
        stagger: true,
        seed,
        toneRange: 0.22,
        grain: fine,
      });

    case "block":
      return masonry({
        cols: 2,
        rows: 4,
        joint: 0.05,
        stagger: true,
        seed: seed + 7,
        toneRange: 0.1,
        grain: fine,
      });

    case "stone": {
      // Mamposteria irregular: se deforma la retícula con ruido grueso antes de
      // cortarla, de modo que las piezas dejan de ser rectangulos regulares.
      const warp = fbm({ baseFrequency: 6, octaves: 3, persistence: 0.5, seed: seed + 31 });
      const base = masonry({
        cols: 3,
        rows: 6,
        joint: 0.09,
        stagger: true,
        seed: seed + 13,
        toneRange: 0.3,
        grain: fine,
      });
      return (u, v) => {
        const du = (warp(u, v) - 0.5) * 0.09;
        const dv = (warp(v + 0.37, u + 0.11) - 0.5) * 0.06;
        return base(u + du, v + dv);
      };
    }

    case "concrete":
      return (u, v) => {
        const blotch = coarse(u, v);
        const grain = fine(u, v);
        const pore = grain > 0.86 ? (grain - 0.86) / 0.14 : 0;
        return {
          shade: 0.94 + blotch * 0.12 + grain * 0.04 - pore * 0.25,
          height: 0.55 + blotch * 0.2 - pore * 0.4,
          roughness: 0.95 + blotch * 0.1,
        };
      };

    case "stucco": {
      const bumps = fbm({ baseFrequency: 64, octaves: 3, persistence: 0.5, seed: seed + 5 });
      return (u, v) => {
        const value = bumps(u, v);
        return {
          shade: 0.95 + value * 0.1,
          height: 0.35 + value * 0.5,
          roughness: 1,
        };
      };
    }

    case "wood-planks": {
      const planks = 5;
      const grainNoise = fbm({
        baseFrequency: 8,
        octaves: 4,
        persistence: 0.6,
        seed: seed + 17,
      });
      return (u, v) => {
        const plankIndex = wrap(Math.floor(v * planks), planks);
        const localV = frac(v * planks);
        const tone = cellRandom(0, plankIndex, seed);

        // Las vetas son anillos deformados a lo largo de la tabla.
        const rings = Math.sin(
          (u * 9 + grainNoise(u, v + plankIndex * 0.31) * 6 + tone * 5) * Math.PI * 2,
        );
        const grain = 0.5 + rings * 0.18;
        const gap = jointFactor(localV, 0.03);

        return {
          shade: mix(0.6, 0.92 + tone * 0.16 + grain * 0.12, gap),
          height: mix(0.15, 0.7 + grain * 0.25, gap),
          roughness: mix(1.05, 0.9 + grain * 0.15, gap),
        };
      };
    }

    case "wood-parquet": {
      const planks = createPattern("wood-planks");
      return (u, v) => {
        // Damero: cada celda gira la veta 90 grados respecto de sus vecinas.
        const cellU = wrap(Math.floor(u * 2), 2);
        const cellV = wrap(Math.floor(v * 2), 2);
        const rotated = (cellU + cellV) % 2 !== 0;
        const localU = frac(u * 2);
        const localV = frac(v * 2);
        const sample = rotated ? planks(localV, localU) : planks(localU, localV);
        const border = Math.min(jointFactor(localU, 0.02), jointFactor(localV, 0.02));
        return {
          shade: mix(0.62, sample.shade, border),
          height: mix(0.2, sample.height, border),
          roughness: sample.roughness,
        };
      };
    }

    case "ceramic-tile":
      return (u, v) => {
        const localU = frac(u * 2);
        const localV = frac(v * 2);
        const grout = Math.min(jointFactor(localU, 0.045), jointFactor(localV, 0.045));
        const tone = cellRandom(wrap(Math.floor(u * 2), 2), wrap(Math.floor(v * 2), 2), seed);
        const sheen = fine(u, v);
        return {
          shade: mix(0.75, 0.97 + tone * 0.06 + sheen * 0.03, grout),
          height: mix(0.15, 0.85, grout),
          // La ceramica es brillante; la junta de mortero no.
          roughness: mix(1.1, 0.55 + sheen * 0.1, grout),
        };
      };

    case "marble": {
      const turbulence = fbm({
        baseFrequency: 5,
        octaves: 5,
        persistence: 0.62,
        seed: seed + 23,
      });
      return (u, v) => {
        // Los factores de u y v son enteros: la veta cierra al repetir.
        const distorted = u * 3 + v * 1 + turbulence(u, v) * 4;
        const vein = Math.abs(Math.sin(distorted * Math.PI));
        const sharp = Math.pow(1 - vein, 6);
        const secondary = Math.pow(1 - Math.abs(Math.sin(distorted * Math.PI * 3)), 12);
        return {
          shade: 1 - sharp * 0.34 - secondary * 0.12,
          height: 0.5 + sharp * 0.08,
          roughness: 1 - sharp * 0.15,
        };
      };
    }

    case "roof-shingle": {
      const rows = 8;
      const cols = 6;
      return (u, v) => {
        const rowIndex = wrap(Math.floor(v * rows), rows);
        const shift = rowIndex % 2 !== 0 ? 0.5 : 0;
        const localU = frac(u * cols + shift);
        const localV = frac(v * rows);
        const tone = cellRandom(wrap(Math.floor(u * cols + shift), cols), rowIndex, seed);

        // Cada teja cae en curva: la sombra crece hacia el borde inferior.
        const curve = Math.sin(localU * Math.PI);
        const exposure = clamp01((localV - 0.08) / 0.92);
        const shadow = clamp01((0.18 - localV) / 0.18);
        const edge = jointFactor(localU, 0.05);

        return {
          shade: mix(0.55, 0.9 + tone * 0.18 + curve * 0.1 - shadow * 0.35, edge),
          height: mix(0.1, 0.35 + exposure * 0.5 + curve * 0.15, edge),
          roughness: 0.95 + tone * 0.1,
        };
      };
    }

    case "roof-metal":
      return (u, v) => {
        const ribs = 6;
        const localU = frac(u * ribs);
        // Onda triangular: pendiente constante hacia la costura.
        const triangle = 1 - Math.abs(localU * 2 - 1);
        const seam = jointFactor(localU, 0.06);
        const streak = fine(u, v * 3);
        return {
          shade: 0.86 + triangle * 0.22 + streak * 0.06 - (1 - seam) * 0.2,
          height: 0.2 + triangle * 0.8,
          roughness: 0.85 + streak * 0.2,
        };
      };

    case "grass": {
      const blades = fbm({
        baseFrequency: 96,
        baseFrequencyY: 32,
        octaves: 3,
        persistence: 0.55,
        seed: seed + 3,
      });
      const patches = fbm({ baseFrequency: 6, octaves: 3, persistence: 0.6, seed: seed + 9 });
      return (u, v) => {
        const blade = blades(u, v);
        const patch = patches(u, v);
        return {
          shade: 0.8 + blade * 0.35 + patch * 0.15,
          height: 0.3 + blade * 0.7,
          roughness: 1,
        };
      };
    }

    case "gravel": {
      const cells = 14;
      return (u, v) => {
        let best = 0;
        let bestTone = 0;

        // Se recorren las celdas vecinas y gana la piedra mas cercana: da
        // guijarros redondeados con tamano variable sin dibujar circulos.
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const cx = Math.floor(u * cells) + dx;
            const cy = Math.floor(v * cells) + dy;
            // La posicion usa la celda real y el sorteo su equivalente dentro
            // del periodo: la piedra del borde derecho es la del izquierdo.
            const wx = ((cx % cells) + cells) % cells;
            const wy = ((cy % cells) + cells) % cells;
            const jitterX = cellRandom(wx, wy, seed);
            const jitterY = cellRandom(wx, wy, seed + 1);
            const radius = 0.34 + cellRandom(wx, wy, seed + 2) * 0.2;

            const px = (cx + jitterX) / cells;
            const py = (cy + jitterY) / cells;
            const dist = Math.hypot(u - px, v - py) * cells;
            const dome = clamp01(1 - dist / (radius * 2));
            if (dome > best) {
              best = dome;
              bestTone = cellRandom(wx, wy, seed + 3);
            }
          }
        }

        const dome = Math.sqrt(best);
        return {
          shade: 0.7 + dome * 0.4 + bestTone * 0.15,
          height: dome,
          roughness: 1,
        };
      };
    }

    case "fabric": {
      const threads = 48;
      return (u, v) => {
        const warp = Math.sin(u * threads * Math.PI * 2);
        const weft = Math.sin(v * threads * Math.PI * 2);
        // El hilo que pasa por encima alterna en cada cruce.
        const over = warp * weft > 0 ? warp : weft;
        const lint = fine(u, v);
        return {
          shade: 0.93 + over * 0.09 + lint * 0.06,
          height: 0.45 + over * 0.35,
          roughness: 1.05,
        };
      };
    }

    case "brushed-metal": {
      // Pocas celdas a lo ancho y muchas a lo alto: el ruido queda estirado y
      // raya el metal en una sola direccion sin abrir costura al repetir.
      const brush = fbm({
        baseFrequency: 4,
        baseFrequencyY: 128,
        octaves: 2,
        persistence: 0.5,
        seed: seed + 11,
      });
      return (u, v) => {
        const streak = brush(u, v);
        return {
          shade: 0.92 + streak * 0.16,
          height: 0.45 + streak * 0.15,
          roughness: 0.8 + streak * 0.35,
        };
      };
    }

    default: {
      const exhaustive: never = pattern;
      throw new Error(`Patron de textura no soportado: ${String(exhaustive)}`);
    }
  }
}

const cache = new Map<TexturePattern, PatternFunction>();

/** Funcion del patron, construida una sola vez por patron. */
export function patternFunction(pattern: TexturePattern): PatternFunction {
  const cached = cache.get(pattern);
  if (cached) return cached;
  const created = createPattern(pattern);
  cache.set(pattern, created);
  return created;
}
