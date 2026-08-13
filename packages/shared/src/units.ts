import type { UnitSystem } from "@archvision/types";

/**
 * Conversion de unidades.
 *
 * INVARIANTE: el modelo se almacena siempre en metros. Estas utilidades solo
 * traducen para entrada/salida de la interfaz.
 */

/** Cuantos metros vale 1 unidad de cada sistema. */
const METERS_PER_UNIT: Record<UnitSystem, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

export const UNIT_SUFFIX: Record<UnitSystem, string> = {
  m: "m",
  cm: "cm",
  mm: "mm",
  ft: "ft",
  in: "in",
};

/** Decimales razonables por unidad al mostrar valores. */
const DISPLAY_PRECISION: Record<UnitSystem, number> = {
  m: 2,
  cm: 1,
  mm: 0,
  ft: 2,
  in: 1,
};

/** Convierte un valor expresado en `unit` a metros. */
export function toMeters(value: number, unit: UnitSystem): number {
  return value * METERS_PER_UNIT[unit];
}

/** Convierte metros a la unidad indicada. */
export function fromMeters(meters: number, unit: UnitSystem): number {
  return meters / METERS_PER_UNIT[unit];
}

/** Convierte entre dos unidades arbitrarias. */
export function convert(
  value: number,
  from: UnitSystem,
  to: UnitSystem,
): number {
  return fromMeters(toMeters(value, from), to);
}

/** Formatea una longitud en metros para mostrarla en `unit`. */
export function formatLength(
  meters: number,
  unit: UnitSystem = "m",
  options: { withSuffix?: boolean } = {},
): string {
  const { withSuffix = true } = options;
  const value = fromMeters(meters, unit);
  const text = value.toFixed(DISPLAY_PRECISION[unit]);
  return withSuffix ? `${text} ${UNIT_SUFFIX[unit]}` : text;
}

/** Formatea un area en m2 respetando la unidad de visualizacion. */
export function formatArea(squareMeters: number, unit: UnitSystem = "m"): string {
  if (unit === "ft" || unit === "in") {
    const squareFeet = squareMeters / (0.3048 * 0.3048);
    return `${squareFeet.toFixed(1)} ft²`;
  }
  return `${squareMeters.toFixed(2)} m²`;
}

/**
 * Interpreta texto introducido por el usuario y lo devuelve en metros.
 * Acepta "3.5", "3,5", "350cm", "2 m", "10ft", "12 in".
 * Devuelve null si no es interpretable.
 */
export function parseLengthInput(
  raw: string,
  fallbackUnit: UnitSystem,
): number | null {
  const text = raw.trim().toLowerCase().replace(",", ".");
  if (text.length === 0) return null;

  const match = /^(-?\d+(?:\.\d+)?)\s*(m|cm|mm|ft|in|")?$/.exec(text);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const rawUnit = match[2];
  const unit: UnitSystem =
    rawUnit === undefined
      ? fallbackUnit
      : rawUnit === '"'
        ? "in"
        : (rawUnit as UnitSystem);

  return toMeters(amount, unit);
}

/** Redondea a un multiplo (usado por el snapping a cuadricula). */
export function snapTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;
