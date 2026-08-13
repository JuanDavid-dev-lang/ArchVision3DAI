import { describe, expect, it } from "vitest";
import { priceFor, yearlySavingCents } from "@archvision/config";
import { addMonths, daysLeft, nextPeriod, periodEnd } from "./periods";
import { GRACE_DAYS, entitlementOf } from "./entitlements";
import {
  applyApprovedPayment,
  applyFailedPayment,
  changePlan,
  expireIfGraceOver,
  isDueForRenewal,
  requestCancel,
  resumeSubscription,
  startSubscription,
} from "./state";
import { buildReference, parseReference } from "./reference";
import type { PaymentOutcome, SubscriptionSnapshot } from "./types";

const utc = (iso: string): Date => new Date(iso);

function approved(overrides: Partial<PaymentOutcome> = {}): PaymentOutcome {
  return {
    reference: "av-pro-month-new-20260101000000-abc",
    status: "approved",
    amountCents: 7_900_000,
    currency: "COP",
    providerPaymentId: "tx-1",
    failureReason: null,
    ...overrides,
  };
}

function subscribed(now: Date): SubscriptionSnapshot {
  const created = startSubscription({
    plan: "pro",
    interval: "month",
    amountCents: 7_900_000,
    currency: "COP",
    now,
  });
  return applyApprovedPayment(created, approved(), now);
}

describe("aritmetica de periodos", () => {
  it("suma meses sin desplazar la fecha de cobro", () => {
    // 31 de enero no existe en febrero: se recorta, pero marzo recupera el 31.
    const enero = utc("2026-01-31T10:00:00.000Z");
    const febrero = addMonths(enero, 1);
    expect(febrero.toISOString()).toBe("2026-02-28T10:00:00.000Z");

    const marzo = addMonths(febrero, 1, 31);
    expect(marzo.toISOString()).toBe("2026-03-31T10:00:00.000Z");
  });

  it("respeta el ano bisiesto", () => {
    expect(addMonths(utc("2028-01-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("el ciclo anual cubre doce meses", () => {
    expect(periodEnd(utc("2026-03-15T00:00:00.000Z"), "year").toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });

  it("un cobro tardio no le quita dias al cliente", () => {
    const fin = utc("2026-02-01T00:00:00.000Z");
    const cobro = utc("2026-02-03T00:00:00.000Z");
    const siguiente = nextPeriod(fin, "month", cobro);

    // Parte del fin anterior, no del dia del cobro.
    expect(siguiente.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(siguiente.end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("un retraso mayor que un periodo se reancla en el cobro", () => {
    const fin = utc("2026-02-01T00:00:00.000Z");
    const cobro = utc("2026-05-10T00:00:00.000Z");
    expect(nextPeriod(fin, "month", cobro).start.toISOString()).toBe(
      "2026-05-10T00:00:00.000Z",
    );
  });
});

describe("precios", () => {
  it("el plan anual equivale a diez mensualidades", () => {
    const mes = priceFor("pro", "month");
    const ano = priceFor("pro", "year");
    expect(ano?.amountCents).toBe((mes?.amountCents ?? 0) * 10);
    expect(yearlySavingCents("pro")).toBe((mes?.amountCents ?? 0) * 2);
  });

  it("el plan gratuito no tiene ciclo anual", () => {
    expect(priceFor("free", "year")).toBeNull();
  });
});

describe("derechos segun el estado", () => {
  const now = utc("2026-01-15T00:00:00.000Z");

  it("sin suscripcion se aplica el plan gratuito", () => {
    const entitlement = entitlementOf(null, now);
    expect(entitlement.plan).toBe("free");
    expect(entitlement.paid).toBe(false);
    expect(entitlement.reason).toBe("sin-suscripcion");
  });

  it("una suscripcion sin pagar no da derecho a nada", () => {
    const created = startSubscription({
      plan: "pro",
      interval: "month",
      amountCents: 7_900_000,
      currency: "COP",
      now,
    });
    expect(entitlementOf(created, now).plan).toBe("free");
  });

  it("el primer cobro aprobado abre el periodo", () => {
    const active = subscribed(now);
    expect(active.status).toBe("active");
    expect(active.currentPeriodEnd.toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(entitlementOf(active, now).plan).toBe("pro");
  });

  it("un periodo vencido sin renovar deja de dar derecho", () => {
    const active = subscribed(now);
    const despues = utc("2026-03-01T00:00:00.000Z");
    expect(entitlementOf(active, despues).plan).toBe("free");
    expect(entitlementOf(active, despues).reason).toBe("periodo-vencido");
  });

  it("un impago conserva el servicio durante la gracia", () => {
    const impagado = applyFailedPayment(subscribed(now), now);
    expect(impagado.status).toBe("past_due");

    const dentro = entitlementOf(impagado, utc("2026-01-18T00:00:00.000Z"));
    expect(dentro.plan).toBe("pro");
    expect(dentro.graceDaysLeft).toBe(4);

    const fuera = entitlementOf(
      impagado,
      utc(`2026-01-${15 + GRACE_DAYS + 1}T00:00:00.000Z`),
    );
    expect(fuera.plan).toBe("free");
    expect(fuera.reason).toBe("gracia-agotada");
  });

  it("reintentar un cobro no reinicia el periodo de gracia", () => {
    const primero = applyFailedPayment(subscribed(now), now);
    const segundo = applyFailedPayment(primero, utc("2026-01-18T00:00:00.000Z"));
    expect(segundo.pastDueSince?.toISOString()).toBe(primero.pastDueSince?.toISOString());
  });

  it("una baja conserva lo pagado hasta el final del periodo", () => {
    const cancelada = requestCancel(subscribed(now), utc("2026-01-20T00:00:00.000Z"));
    expect(cancelada.cancelAtPeriodEnd).toBe(true);

    expect(entitlementOf(cancelada, utc("2026-02-01T00:00:00.000Z")).plan).toBe("pro");
    expect(entitlementOf(cancelada, utc("2026-02-20T00:00:00.000Z")).plan).toBe("free");
  });
});

describe("ciclo de vida", () => {
  const now = utc("2026-01-15T00:00:00.000Z");

  it("un cobro aprobado tras la baja no resucita la suscripcion", () => {
    const cancelada = requestCancel(subscribed(now), now);
    const despues = applyApprovedPayment(cancelada, approved(), now);
    expect(despues.status).toBe("canceled");
    expect(despues.cancelAtPeriodEnd).toBe(true);
  });

  it("se puede deshacer la baja mientras quede periodo", () => {
    const cancelada = requestCancel(subscribed(now), now);
    const reanudada = resumeSubscription(cancelada, utc("2026-02-01T00:00:00.000Z"));
    expect(reanudada?.status).toBe("active");
    expect(reanudada?.cancelAtPeriodEnd).toBe(false);
  });

  it("no se puede deshacer una baja ya consumada", () => {
    const cancelada = requestCancel(subscribed(now), now);
    expect(resumeSubscription(cancelada, utc("2026-03-01T00:00:00.000Z"))).toBeNull();
  });

  it("solo se cobra despues de que el periodo venza y con medio de pago", () => {
    const conMedio = applyApprovedPayment(
      subscribed(now),
      approved({ paymentSourceId: "ps-1" }),
      now,
    );

    expect(isDueForRenewal(conMedio, utc("2026-02-01T00:00:00.000Z"))).toBe(false);
    expect(isDueForRenewal(conMedio, utc("2026-03-16T00:00:00.000Z"))).toBe(true);

    const sinMedio = { ...conMedio, paymentSourceId: null };
    expect(isDueForRenewal(sinMedio, utc("2026-03-16T00:00:00.000Z"))).toBe(false);
  });

  it("la gracia agotada termina la suscripcion", () => {
    const impagado = applyFailedPayment(subscribed(now), now);
    expect(expireIfGraceOver(impagado, utc("2026-01-18T00:00:00.000Z"), GRACE_DAYS)).toBeNull();

    const expirada = expireIfGraceOver(
      impagado,
      utc("2026-01-25T00:00:00.000Z"),
      GRACE_DAYS,
    );
    expect(expirada?.status).toBe("canceled");
  });

  it("el cambio de plan mantiene el periodo ya pagado", () => {
    const active = subscribed(now);
    const cambiada = changePlan(active, {
      plan: "studio",
      interval: "year",
      amountCents: 249_000_000,
    });

    expect(cambiada.plan).toBe("studio");
    expect(cambiada.currentPeriodEnd.toISOString()).toBe(
      active.currentPeriodEnd.toISOString(),
    );
  });

  it("guarda el medio de pago que devuelve la pasarela", () => {
    const active = applyApprovedPayment(
      subscribed(now),
      approved({ paymentSourceId: "ps-9" }),
      now,
    );
    expect(active.paymentSourceId).toBe("ps-9");
  });
});

describe("referencia de pago", () => {
  it("es legible, unica y sin datos personales", () => {
    const ref = buildReference(
      { plan: "pro", interval: "month", kind: "alta" },
      utc("2026-01-15T10:30:00.000Z"),
      "a1b2c3d4e5f6",
    );

    expect(ref).toBe("av-pro-month-new-20260115103000-a1b2c3d4e5");
    expect(ref).not.toMatch(/@/);
    expect(parseReference(ref)).toEqual({
      plan: "pro",
      interval: "month",
      kind: "alta",
    });
  });

  it("descarta una referencia ajena", () => {
    expect(parseReference("pedido-1234")).toBeNull();
  });

  it("limpia caracteres que la pasarela no acepta", () => {
    const ref = buildReference(
      { plan: "studio", interval: "year", kind: "renovacion" },
      utc("2026-06-01T00:00:00.000Z"),
      "a/b c#d",
    );
    expect(ref).toMatch(/^av-studio-year-ren-20260601000000-abcd$/);
  });
});

describe("dias restantes", () => {
  it("nunca es negativo", () => {
    expect(daysLeft(utc("2026-01-01T00:00:00.000Z"), utc("2026-02-01T00:00:00.000Z"))).toBe(0);
  });
});
