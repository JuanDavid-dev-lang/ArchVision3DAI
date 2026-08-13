/**
 * Ruido determinista para texturas procedurales.
 *
 * Se evita `Math.random` a proposito: la misma definicion de material debe
 * producir siempre la misma imagen. Si no, cada recarga cambiaria el aspecto
 * del modelo y las capturas de un mismo proyecto no coincidirian entre si.
 */

/** Generador congruente rapido con estado de 32 bits. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash entero estable a partir de una cadena (para semillas por nombre). */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Ruido de valor con periodo entero.
 *
 * El periodo es lo que hace la textura repetible sin costura: al muestrear en
 * `[0, period)` los bordes opuestos leen exactamente la misma celda.
 */
export class ValueNoise {
  private readonly values: Float32Array;

  /**
   * @param periodX Celdas en el eje horizontal antes de repetirse.
   * @param periodY Celdas en el eje vertical. Distinto de `periodX` para
   *   patrones estirados (metal cepillado, cesped) que deben seguir cerrando.
   */
  constructor(
    private readonly periodX: number,
    private readonly periodY: number,
    seed: number,
  ) {
    const random = mulberry32(seed);
    this.values = new Float32Array(periodX * periodY);
    for (let i = 0; i < this.values.length; i += 1) this.values[i] = random();
  }

  private at(x: number, y: number): number {
    const { periodX, periodY } = this;
    const cx = ((x % periodX) + periodX) % periodX;
    const cy = ((y % periodY) + periodY) % periodY;
    return this.values[cy * periodX + cx] ?? 0;
  }

  /** Valor interpolado en 0..1. */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(x - x0);
    const fy = smoothstep(y - y0);

    const v00 = this.at(x0, y0);
    const v10 = this.at(x0 + 1, y0);
    const v01 = this.at(x0, y0 + 1);
    const v11 = this.at(x0 + 1, y0 + 1);

    const top = v00 + (v10 - v00) * fx;
    const bottom = v01 + (v11 - v01) * fx;
    return top + (bottom - top) * fy;
  }
}

export interface FbmOptions {
  /** Celdas de la octava base en el ancho de la textura. */
  baseFrequency: number;
  /** Celdas en alto. Por omision, las mismas que en ancho. */
  baseFrequencyY?: number;
  octaves: number;
  /** Peso de cada octava respecto de la anterior. */
  persistence: number;
  seed: number;
}

/**
 * Suma de octavas de ruido, normalizada a 0..1.
 *
 * Devuelve una funcion de muestreo en coordenadas normalizadas (0..1) para que
 * quien la usa no tenga que pensar en el tamano en pixeles de la textura.
 */
export function fbm(options: FbmOptions): (u: number, v: number) => number {
  const layers: {
    noise: ValueNoise;
    frequencyX: number;
    frequencyY: number;
    amplitude: number;
  }[] = [];

  let frequencyX = Math.max(1, Math.round(options.baseFrequency));
  let frequencyY = Math.max(1, Math.round(options.baseFrequencyY ?? options.baseFrequency));
  let amplitude = 1;
  let total = 0;

  for (let octave = 0; octave < options.octaves; octave += 1) {
    layers.push({
      noise: new ValueNoise(frequencyX, frequencyY, options.seed + octave * 7919),
      frequencyX,
      frequencyY,
      amplitude,
    });
    total += amplitude;
    frequencyX *= 2;
    frequencyY *= 2;
    amplitude *= options.persistence;
  }

  return (u, v) => {
    let sum = 0;
    for (const layer of layers) {
      sum +=
        layer.noise.sample(u * layer.frequencyX, v * layer.frequencyY) * layer.amplitude;
    }
    return sum / total;
  };
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
