import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { integritySignature, verifyEventChecksum } from "./signatures";

/**
 * El webhook es el unico punto de la aplicacion donde alguien sin sesion puede
 * cambiar el plan de un usuario. Estas pruebas cubren lo que separa un evento
 * legitimo de uno inventado.
 */

const SECRET = "secreto-de-eventos";

/** Construye un evento firmado como lo hace Wompi. */
function signedEvent(overrides: {
  id?: string;
  status?: string;
  amount?: number;
  timestamp?: number;
  secret?: string;
}) {
  const transaction = {
    id: overrides.id ?? "tx-1",
    status: overrides.status ?? "APPROVED",
    amount_in_cents: overrides.amount ?? 7_900_000,
    reference: "av-pro-month-new-20260101000000-abc",
  };
  const timestamp = overrides.timestamp ?? 1_767_225_600;

  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const concatenated = [
    transaction.id,
    transaction.status,
    String(transaction.amount_in_cents),
  ].join("");

  const checksum = createHash("sha256")
    .update(`${concatenated}${timestamp}${overrides.secret ?? SECRET}`, "utf8")
    .digest("hex");

  return {
    event: "transaction.updated",
    data: { transaction },
    timestamp,
    signature: { properties, checksum },
  };
}

describe("firma de integridad del checkout", () => {
  it("depende del importe, de la referencia y de la moneda", () => {
    const base = {
      reference: "av-pro-month-new-1",
      amountCents: 7_900_000,
      currency: "COP",
      secret: "s3cr3t",
    };

    const firma = integritySignature(base);
    expect(firma).toHaveLength(64);

    // Cambiar el importe cambia la firma: es lo que impide editar el precio
    // en la URL del checkout.
    expect(integritySignature({ ...base, amountCents: 100_000 })).not.toBe(firma);
    expect(integritySignature({ ...base, reference: "otra" })).not.toBe(firma);
    expect(integritySignature({ ...base, currency: "USD" })).not.toBe(firma);
  });

  it("es estable para la misma entrada", () => {
    const params = {
      reference: "av-studio-year-ren-2",
      amountCents: 249_000_000,
      currency: "COP",
      secret: "s3cr3t",
    };
    expect(integritySignature(params)).toBe(integritySignature(params));
  });
});

describe("verificacion de eventos", () => {
  it("acepta un evento correctamente firmado", () => {
    expect(verifyEventChecksum(signedEvent({}), SECRET)).toBe(true);
  });

  it("rechaza un importe manipulado despues de firmar", () => {
    const event = signedEvent({});
    event.data.transaction.amount_in_cents = 100;
    expect(verifyEventChecksum(event, SECRET)).toBe(false);
  });

  it("rechaza un estado manipulado", () => {
    const event = signedEvent({ status: "DECLINED" });
    event.data.transaction.status = "APPROVED";
    expect(verifyEventChecksum(event, SECRET)).toBe(false);
  });

  it("rechaza una firma hecha con otro secreto", () => {
    expect(verifyEventChecksum(signedEvent({ secret: "otro" }), SECRET)).toBe(false);
  });

  it("rechaza si cambia la marca de tiempo", () => {
    const event = signedEvent({});
    event.timestamp = event.timestamp + 1;
    expect(verifyEventChecksum(event, SECRET)).toBe(false);
  });

  it("rechaza un cuerpo sin firma", () => {
    expect(verifyEventChecksum({ data: {} }, SECRET)).toBe(false);
    expect(verifyEventChecksum({ data: {}, signature: {} }, SECRET)).toBe(false);
    expect(
      verifyEventChecksum(
        { data: {}, signature: { properties: [], checksum: "x" } },
        SECRET,
      ),
    ).toBe(false);
  });

  it("reordenar los campos firmados invalida la firma", () => {
    const event = signedEvent({});
    const [first, second, ...rest] = event.signature.properties;
    event.signature.properties = [second!, first!, ...rest];
    expect(verifyEventChecksum(event, SECRET)).toBe(false);
  });

  it("un campo inexistente aporta cadena vacia y no altera el resultado", () => {
    // No es un agujero: para que la firma cuadre hay que conocer el secreto, y
    // anadir un nombre de campo que no existe no cambia lo que se concatena.
    const event = signedEvent({});
    event.signature.properties = [...event.signature.properties, "transaction.inexistente"];
    expect(verifyEventChecksum(event, SECRET)).toBe(true);
  });
});
