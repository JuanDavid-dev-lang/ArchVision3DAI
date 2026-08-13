/**
 * Valores predeterminados del dominio arquitectonico.
 *
 * Todos en metros. Sirven como "valores inteligentes" cuando el usuario o la
 * IA no especifican una dimension.
 */
export const DEFAULTS = {
  wall: {
    height: 2.6,
    thickness: 0.15,
    exteriorThickness: 0.25,
  },
  door: {
    width: 0.9,
    height: 2.05,
  },
  window: {
    width: 1.2,
    height: 1.2,
    sillHeight: 0.95,
    frameThickness: 0.05,
  },
  floor: {
    height: 2.6,
    slabThickness: 0.2,
  },
  stair: {
    width: 1.0,
    tread: 0.28,
    riser: 0.175,
  },
  roof: {
    slopeDeg: 30,
    overhang: 0.6,
    thickness: 0.2,
  },
  column: {
    width: 0.3,
    depth: 0.3,
  },
  grid: {
    /** Paso de cuadricula del editor 2D, en metros. */
    step: 0.1,
    majorEvery: 10,
  },
} as const;

/** Numero de escalones sugerido para una altura dada. */
export function suggestedSteps(totalRise: number): number {
  const steps = Math.round(totalRise / DEFAULTS.stair.riser);
  return Math.max(2, steps);
}
