/**
 * Generacion de identificadores.
 *
 * REGLA: los ids son UUID v4 y nunca se derivan de indices de array ni de
 * posiciones, para que las referencias sobrevivan a reordenamientos.
 */

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

function getCrypto(): CryptoLike | undefined {
  return (globalThis as { crypto?: CryptoLike }).crypto;
}

export function createId(): string {
  const c = getCrypto();
  if (c?.randomUUID) return c.randomUUID();

  // Fallback en entornos sin WebCrypto completo.
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Version 4 y variante RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Id legible con prefijo, util en logs y depuracion. */
export function createPrefixedId(prefix: string): string {
  return `${prefix}_${createId().replace(/-/g, "").slice(0, 16)}`;
}

const SLUG_MAX = 60;

/** Rango Unicode de marcas diacriticas combinantes. */
const COMBINING_START = 0x0300;
const COMBINING_END = 0x036f;

function stripDiacritics(input: string): string {
  return Array.from(input.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_START || code > COMBINING_END;
    })
    .join("");
}

export function slugify(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}
