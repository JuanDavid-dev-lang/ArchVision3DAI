import { createHash } from "node:crypto";

/**
 * Firmas de la pasarela.
 *
 * Vive en este paquete, y no junto al adaptador, para poder probarlo: es el
 * codigo que decide si un mensaje de un desconocido cambia el plan de alguien.
 *
 * Usa `node:crypto`, asi que este modulo NO se exporta desde el indice: el
 * resto del paquete es codigo puro que tambien corre en el navegador, y una
 * importacion accidental lo romperia.
 */

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Firma de integridad del checkout.
 *
 * Wompi la exige para que nadie pueda cambiar el importe en la URL antes de
 * pagar: sin ella, un enlace de 79.000 se editaria a 1.000.
 */
export function integritySignature(params: {
  reference: string;
  amountCents: number;
  currency: string;
  secret: string;
}): string {
  return sha256(
    `${params.reference}${params.amountCents}${params.currency}${params.secret}`,
  );
}

/** Lee un valor anidado por su ruta ("transaction.id"). */
function readPath(source: unknown, path: string): string {
  let current: unknown = source;
  for (const key of path.split(".")) {
    if (typeof current !== "object" || current === null) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return current === null || current === undefined ? "" : String(current);
}

/** Comparacion en tiempo constante sobre texto hexadecimal. */
function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  // Sin salida temprana: el tiempo de respuesta no debe revelar cuantos
  // caracteres del checksum eran correctos.
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface SignedEventBody {
  data?: unknown;
  timestamp?: number | string;
  signature?: { properties?: string[]; checksum?: string };
}

/**
 * Verifica la firma de un evento de Wompi.
 *
 * El checksum es el SHA-256 de los valores que la propia firma enumera, en su
 * orden, seguidos de la marca de tiempo y del secreto de eventos. Se toman los
 * campos que indica el mensaje y no una lista propia: asi, anadir un campo
 * firmado en el futuro no obliga a cambiar este codigo.
 */
export function verifyEventChecksum(
  body: SignedEventBody,
  secret: string,
): boolean {
  const properties = body.signature?.properties;
  const checksum = body.signature?.checksum;
  if (!Array.isArray(properties) || properties.length === 0) return false;
  if (typeof checksum !== "string" || checksum.length === 0) return false;

  const concatenated = properties
    .map((property) => readPath(body.data, property))
    .join("");

  return equalConstantTime(
    sha256(`${concatenated}${body.timestamp ?? ""}${secret}`),
    checksum,
  );
}
