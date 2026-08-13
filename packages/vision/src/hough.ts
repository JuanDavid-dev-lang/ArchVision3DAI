import type { BinaryImage } from "./image";

/**
 * Transformada de Hough para rectas.
 *
 * Se acumulan TODOS los pixeles de tinta, no solo los bordes: un muro dibujado
 * con dos lineas paralelas y relleno produce asi un unico maximo centrado en
 * su eje, que es justo la recta que interesa. Si se acumularan solo los bordes
 * cada muro daria dos rectas y habria que emparejarlas despues.
 */

export interface HoughLine {
  /** Angulo de la normal a la recta, en radianes, dentro de [0, PI). */
  theta: number;
  /** Distancia con signo del origen a la recta, en pixeles. */
  rho: number;
  /** Votos acumulados. */
  votes: number;
}

export interface HoughOptions {
  /** Numero de divisiones del angulo entre 0 y PI. */
  angleSteps: number;
  /** Votos minimos para considerar una recta. */
  minVotes: number;
  /** Separacion minima entre maximos, en pixeles de rho. */
  rhoSuppression: number;
  /** Separacion minima entre maximos, en pasos de angulo. */
  thetaSuppression: number;
  /** Numero maximo de rectas devueltas. */
  maxLines: number;
}

export const DEFAULT_HOUGH: HoughOptions = {
  angleSteps: 180,
  minVotes: 40,
  rhoSuppression: 12,
  thetaSuppression: 2,
  maxLines: 120,
};

export interface HoughAccumulator {
  /** Acumulador de tamano `angleSteps * rhoSteps`. */
  data: Int32Array;
  angleSteps: number;
  rhoSteps: number;
  /** Desplazamiento aplicado a rho para que el indice sea positivo. */
  rhoOffset: number;
  cos: Float64Array;
  sin: Float64Array;
}

export function accumulate(mask: BinaryImage, angleSteps: number): HoughAccumulator {
  const diagonal = Math.ceil(Math.hypot(mask.width, mask.height));
  const rhoSteps = diagonal * 2 + 1;
  const data = new Int32Array(angleSteps * rhoSteps);

  const cos = new Float64Array(angleSteps);
  const sin = new Float64Array(angleSteps);
  for (let a = 0; a < angleSteps; a += 1) {
    const theta = (a * Math.PI) / angleSteps;
    cos[a] = Math.cos(theta);
    sin[a] = Math.sin(theta);
  }

  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x] !== 1) continue;

      for (let a = 0; a < angleSteps; a += 1) {
        const rho = Math.round(x * (cos[a] ?? 0) + y * (sin[a] ?? 0)) + diagonal;
        const index = a * rhoSteps + rho;
        data[index] = (data[index] ?? 0) + 1;
      }
    }
  }

  return { data, angleSteps, rhoSteps, rhoOffset: diagonal, cos, sin };
}

/**
 * Angulo dominante del dibujo.
 *
 * Casi todos los planos estan trazados sobre dos direcciones perpendiculares,
 * pero el escaneado suele venir girado unos grados. Medir la orientacion
 * dominante permite enderezar la deteccion sin pedirsela al usuario.
 *
 * @returns Angulo en radianes dentro de [0, PI/2).
 */
export function dominantAngle(accumulator: HoughAccumulator): number {
  const { data, angleSteps, rhoSteps } = accumulator;
  const energy = new Float64Array(angleSteps);

  for (let a = 0; a < angleSteps; a += 1) {
    let sum = 0;
    for (let r = 0; r < rhoSteps; r += 1) {
      const votes = data[a * rhoSteps + r] ?? 0;
      // El cuadrado premia las acumulaciones concentradas (rectas reales)
      // frente al reparto uniforme del ruido.
      sum += votes * votes;
    }
    energy[a] = sum;
  }

  // Las dos direcciones de un dibujo ortogonal se refuerzan entre si.
  let best = 0;
  let bestValue = -1;
  const quarter = Math.round(angleSteps / 2);

  for (let a = 0; a < quarter; a += 1) {
    const value = (energy[a] ?? 0) + (energy[(a + quarter) % angleSteps] ?? 0);
    if (value > bestValue) {
      bestValue = value;
      best = a;
    }
  }

  return (best * Math.PI) / angleSteps;
}

/** Maximos locales del acumulador, ordenados por votos. */
export function extractLines(
  accumulator: HoughAccumulator,
  options: HoughOptions,
  angleFilter?: (theta: number) => boolean,
): HoughLine[] {
  const { data, angleSteps, rhoSteps, rhoOffset } = accumulator;
  const candidates: HoughLine[] = [];

  for (let a = 0; a < angleSteps; a += 1) {
    const theta = (a * Math.PI) / angleSteps;
    if (angleFilter && !angleFilter(theta)) continue;

    for (let r = 1; r < rhoSteps - 1; r += 1) {
      const votes = data[a * rhoSteps + r] ?? 0;
      if (votes < options.minVotes) continue;

      // Maximo local estricto en rho: evita quedarse con la falda del pico.
      if (votes < (data[a * rhoSteps + r - 1] ?? 0)) continue;
      if (votes < (data[a * rhoSteps + r + 1] ?? 0)) continue;

      candidates.push({ theta, rho: r - rhoOffset, votes });
    }
  }

  candidates.sort((left, right) => right.votes - left.votes);

  const thetaStep = Math.PI / angleSteps;
  const accepted: HoughLine[] = [];

  for (const candidate of candidates) {
    if (accepted.length >= options.maxLines) break;

    const clash = accepted.some((line) => {
      let deltaTheta = Math.abs(line.theta - candidate.theta);
      // Las rectas casi verticales aparecen en los dos extremos del rango.
      if (deltaTheta > Math.PI / 2) deltaTheta = Math.PI - deltaTheta;
      if (deltaTheta > options.thetaSuppression * thetaStep) return false;

      // Con angulos parecidos, rho es comparable directamente salvo cambio de
      // signo al cruzar el extremo del rango.
      const sameSide = Math.abs(line.theta - candidate.theta) <= Math.PI / 2;
      const deltaRho = sameSide
        ? Math.abs(line.rho - candidate.rho)
        : Math.abs(line.rho + candidate.rho);

      return deltaRho < options.rhoSuppression;
    });

    if (!clash) accepted.push(candidate);
  }

  return accepted;
}
