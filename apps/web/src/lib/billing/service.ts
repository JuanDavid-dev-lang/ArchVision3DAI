import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@archvision/database";
import {
  GRACE_DAYS,
  applyApprovedPayment,
  applyFailedPayment,
  buildReference,
  changePlan,
  entitlementOf,
  expireIfGraceOver,
  requestCancel,
  resumeSubscription,
  startSubscription,
  type Entitlement,
  type PaymentOutcome,
  type SubscriptionSnapshot,
} from "@archvision/billing";
import {
  DEFAULT_PLAN,
  priceFor,
  type BillingInterval,
  type PlanId,
} from "@archvision/config";
import { getEnv } from "@/lib/env";
import { activeProvider, providerById } from "./providers";

/**
 * Servicio de facturacion.
 *
 * Reparto de responsabilidades: `@archvision/billing` decide, la pasarela
 * cobra y este modulo traduce entre ambos y la base de datos.
 *
 * Dos reglas que no se negocian:
 *
 *  1. El plan efectivo se deriva SIEMPRE de la suscripcion, nunca de lo que
 *     diga el cliente. `user.plan` es una copia para no consultar la
 *     suscripcion en cada peticion, y se corrige sola al leerla.
 *  2. Un evento de la pasarela se procesa una vez. Las pasarelas reintentan, y
 *     sin ese control un mismo pago ampliaria el periodo dos veces.
 */

export class BillingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "PROVIDER_UNAVAILABLE"
      | "PLAN_NOT_PURCHASABLE"
      | "NO_SUBSCRIPTION"
      | "ALREADY_ACTIVE"
      | "CANNOT_RESUME",
  ) {
    super(message);
    this.name = "BillingError";
  }
}

type SubscriptionRow = NonNullable<
  Awaited<ReturnType<typeof prisma.subscription.findUnique>>
>;

/** De la fila de Prisma al estado que entiende el paquete de facturacion. */
function toSnapshot(row: SubscriptionRow): SubscriptionSnapshot {
  return {
    plan: row.plan as PlanId,
    status: row.status as SubscriptionSnapshot["status"],
    interval: row.interval as BillingInterval,
    currency: row.currency,
    amountCents: row.amountCents,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    canceledAt: row.canceledAt,
    trialEndsAt: row.trialEndsAt,
    pastDueSince: row.pastDueSince,
    paymentSourceId: row.paymentSourceId,
  };
}

function toRow(snapshot: SubscriptionSnapshot) {
  return {
    plan: snapshot.plan,
    status: snapshot.status,
    interval: snapshot.interval,
    currency: snapshot.currency,
    amountCents: snapshot.amountCents,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.canceledAt,
    trialEndsAt: snapshot.trialEndsAt,
    pastDueSince: snapshot.pastDueSince,
    paymentSourceId: snapshot.paymentSourceId,
  };
}

/**
 * Mantiene `user.plan` acorde con el derecho real.
 *
 * Se llama al leer y al escribir. Asi, una suscripcion que caduca sin que
 * nadie toque nada deja de dar acceso la proxima vez que el usuario entra, sin
 * depender de que un proceso programado se haya ejecutado.
 */
async function syncUserPlan(userId: string, plan: PlanId): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (!user || user.plan === plan) return;

  await prisma.user.update({ where: { id: userId }, data: { plan } });
}

export interface BillingOverview {
  entitlement: Entitlement;
  subscription:
    | (SubscriptionSnapshot & {
        provider: string;
        cardBrand: string | null;
        cardLast4: string | null;
      })
    | null;
  payments: {
    id: string;
    reference: string;
    status: string;
    amountCents: number;
    currency: string;
    description: string;
    failureReason: string | null;
    paidAt: Date | null;
    createdAt: Date;
  }[];
  /** false cuando no hay pasarela utilizable: la interfaz lo dice en vez de fallar al pulsar. */
  checkoutAvailable: boolean;
  providerId: string | null;
}

export async function billingOverview(
  userId: string,
  now: Date = new Date(),
): Promise<BillingOverview> {
  const row = await prisma.subscription.findUnique({ where: { userId } });
  const snapshot = row ? toSnapshot(row) : null;

  // La caducidad se aplica al leer: un impago con la gracia agotada queda
  // cerrado aunque el proceso de renovacion no haya corrido.
  if (snapshot) {
    const expired = expireIfGraceOver(snapshot, now, GRACE_DAYS);
    if (expired && row) {
      await prisma.subscription.update({
        where: { id: row.id },
        data: toRow(expired),
      });
      Object.assign(snapshot, expired);
    }
  }

  const entitlement = entitlementOf(snapshot, now);
  await syncUserPlan(userId, entitlement.plan);

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      reference: true,
      status: true,
      amountCents: true,
      currency: true,
      description: true,
      failureReason: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const provider = activeProvider();

  return {
    entitlement,
    subscription:
      snapshot && row
        ? {
            ...snapshot,
            provider: row.provider,
            cardBrand: row.cardBrand,
            cardLast4: row.cardLast4,
          }
        : null,
    payments,
    checkoutAvailable: provider !== null,
    providerId: provider?.id ?? null,
  };
}

/** Plan que rige ahora mismo para un usuario. */
export async function currentEntitlement(
  userId: string,
  now: Date = new Date(),
): Promise<Entitlement> {
  const row = await prisma.subscription.findUnique({ where: { userId } });
  return entitlementOf(row ? toSnapshot(row) : null, now);
}

export interface CheckoutResult {
  url: string;
  reference: string;
  provider: string;
}

/**
 * Inicia el alta o el cambio de plan.
 *
 * No concede nada: crea la suscripcion en estado `incomplete` y devuelve la
 * URL de pago. El derecho llega cuando la pasarela confirma el cobro, no
 * cuando el usuario pulsa el boton.
 */
export async function startCheckout(
  userId: string,
  params: { plan: PlanId; interval: BillingInterval },
  now: Date = new Date(),
): Promise<CheckoutResult> {
  const provider = activeProvider();
  if (!provider) {
    throw new BillingError(
      "No hay ninguna pasarela de pago configurada",
      "PROVIDER_UNAVAILABLE",
    );
  }

  const price = priceFor(params.plan, params.interval);
  if (!price || price.amountCents <= 0) {
    throw new BillingError(
      "Ese plan no se contrata desde la aplicacion",
      "PLAN_NOT_PURCHASABLE",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) throw new BillingError("Usuario no encontrado", "NO_SUBSCRIPTION");

  const existing = await prisma.subscription.findUnique({ where: { userId } });

  const snapshot = existing
    ? changePlan(toSnapshot(existing), {
        plan: params.plan,
        interval: params.interval,
        amountCents: price.amountCents,
      })
    : startSubscription({
        plan: params.plan,
        interval: params.interval,
        amountCents: price.amountCents,
        currency: "COP",
        now,
      });

  const reference = buildReference(
    { plan: params.plan, interval: params.interval, kind: "alta" },
    now,
    randomBytes(8).toString("hex"),
  );

  await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.subscription.update({
          where: { id: existing.id },
          data: { ...toRow(snapshot), provider: provider.id },
        })
      : await tx.subscription.create({
          data: { userId, provider: provider.id, ...toRow(snapshot) },
        });

    await tx.payment.create({
      data: {
        userId,
        subscriptionId: saved.id,
        provider: provider.id,
        reference,
        status: "pending",
        amountCents: price.amountCents,
        currency: "COP",
        description: `Plan ${params.plan} (${params.interval === "year" ? "anual" : "mensual"})`,
      },
    });
  });

  const session = await provider.createCheckout({
    plan: params.plan,
    interval: params.interval,
    amountCents: price.amountCents,
    currency: "COP",
    reference,
    customerEmail: user.email,
    redirectUrl: new URL("/settings/billing", getEnv().NEXT_PUBLIC_APP_URL).toString(),
  });

  return { url: session.url, reference, provider: provider.id };
}

/**
 * Procesa un evento de la pasarela.
 *
 * Idempotente por construccion: el evento se registra primero con una clave
 * unica y, si ya estaba, no se vuelve a aplicar.
 */
export async function handleProviderEvent(
  providerId: string,
  rawBody: string,
  headers: Headers,
): Promise<{ handled: boolean; reason?: string }> {
  const provider = providerById(providerId === "wompi" ? "wompi" : "manual");
  const event = await provider.parseWebhook({ rawBody, headers });

  // Firma invalida: no se registra ni se procesa. Guardar eventos sin
  // verificar convertiria el webhook en un buzon abierto.
  if (!event) return { handled: false, reason: "firma-invalida" };

  try {
    await prisma.billingEvent.create({
      data: {
        provider: provider.id,
        externalId: event.externalId,
        type: event.type,
        payloadJson: rawBody.slice(0, 20_000),
      },
    });
  } catch {
    // La clave unica (provider, externalId) ya existia: es un reintento.
    return { handled: true, reason: "repetido" };
  }

  if (event.payment) await applyPayment(provider.id, event.payment);

  await prisma.billingEvent.updateMany({
    where: { provider: provider.id, externalId: event.externalId },
    data: { processedAt: new Date() },
  });

  return { handled: true };
}

/** Aplica el resultado de un cobro a la suscripcion que lo origino. */
export async function applyPayment(
  providerId: string,
  outcome: PaymentOutcome,
  now: Date = new Date(),
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { reference: outcome.reference },
    include: { subscription: true },
  });

  // Un cobro sin referencia conocida no es nuestro: puede ser otro comercio
  // compartiendo cuenta de pasarela, o una prueba manual.
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: outcome.status,
      providerPaymentId: outcome.providerPaymentId,
      failureReason: outcome.failureReason,
      paidAt: outcome.status === "approved" ? now : null,
      amountCents: outcome.amountCents > 0 ? outcome.amountCents : payment.amountCents,
    },
  });

  const row = payment.subscription;
  if (!row) return;

  const snapshot = toSnapshot(row);
  const next =
    outcome.status === "approved"
      ? applyApprovedPayment(snapshot, outcome, now)
      : outcome.status === "declined" || outcome.status === "error"
        ? applyFailedPayment(snapshot, now)
        : snapshot;

  await prisma.subscription.update({
    where: { id: row.id },
    data: {
      ...toRow(next),
      provider: providerId,
      ...(outcome.status === "approved"
        ? {
            cardBrand: outcome.cardBrand ?? row.cardBrand,
            cardLast4: outcome.cardLast4 ?? row.cardLast4,
          }
        : {}),
    },
  });

  await syncUserPlan(payment.userId, entitlementOf(next, now).plan);
}

/** Baja: conserva el servicio hasta el final del periodo pagado. */
export async function cancelSubscription(
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionSnapshot> {
  const row = await prisma.subscription.findUnique({ where: { userId } });
  if (!row) throw new BillingError("No hay suscripcion activa", "NO_SUBSCRIPTION");

  const next = requestCancel(toSnapshot(row), now);
  await prisma.subscription.update({ where: { id: row.id }, data: toRow(next) });
  await syncUserPlan(userId, entitlementOf(next, now).plan);

  return next;
}

/** Deshacer una baja mientras quede periodo. */
export async function resumeSubscriptionFor(
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionSnapshot> {
  const row = await prisma.subscription.findUnique({ where: { userId } });
  if (!row) throw new BillingError("No hay suscripcion activa", "NO_SUBSCRIPTION");

  const next = resumeSubscription(toSnapshot(row), now);
  if (!next) {
    throw new BillingError(
      "El periodo ya termino: vuelve a contratar el plan",
      "CANNOT_RESUME",
    );
  }

  await prisma.subscription.update({ where: { id: row.id }, data: toRow(next) });
  await syncUserPlan(userId, entitlementOf(next, now).plan);

  return next;
}

export interface RenewalReport {
  checked: number;
  charged: number;
  failed: number;
  skipped: number;
  expired: number;
}

/**
 * Cobra las renovaciones vencidas.
 *
 * Wompi no tiene suscripciones: alguien tiene que decidir cuando toca cobrar, y
 * ese alguien es este proceso, llamado por un programador externo. Cobra solo
 * despues de que el periodo venza, nunca antes.
 */
export async function runRenewals(
  now: Date = new Date(),
  limit = 100,
): Promise<RenewalReport> {
  const report: RenewalReport = {
    checked: 0,
    charged: 0,
    failed: 0,
    skipped: 0,
    expired: 0,
  };

  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ["active", "past_due"] },
      currentPeriodEnd: { lte: now },
    },
    include: { user: { select: { email: true } } },
    take: limit,
  });

  for (const row of due) {
    report.checked += 1;
    const snapshot = toSnapshot(row);

    const expired = expireIfGraceOver(snapshot, now, GRACE_DAYS);
    if (expired) {
      await prisma.subscription.update({ where: { id: row.id }, data: toRow(expired) });
      await syncUserPlan(row.userId, entitlementOf(expired, now).plan);
      report.expired += 1;
      continue;
    }

    // Baja pedida o sin medio de pago guardado: no hay nada que cobrar. El
    // usuario recibe el aviso en la pantalla de facturacion.
    if (snapshot.cancelAtPeriodEnd || !snapshot.paymentSourceId) {
      report.skipped += 1;
      continue;
    }

    const provider = providerById(row.provider === "wompi" ? "wompi" : "manual");
    const reference = buildReference(
      { plan: snapshot.plan, interval: snapshot.interval, kind: "renovacion" },
      now,
      randomBytes(8).toString("hex"),
    );

    await prisma.payment.create({
      data: {
        userId: row.userId,
        subscriptionId: row.id,
        provider: provider.id,
        reference,
        status: "pending",
        amountCents: snapshot.amountCents,
        currency: snapshot.currency,
        description: `Renovacion ${snapshot.plan} (${snapshot.interval === "year" ? "anual" : "mensual"})`,
      },
    });

    const outcome = await provider.chargeSavedSource({
      paymentSourceId: snapshot.paymentSourceId,
      amountCents: snapshot.amountCents,
      currency: snapshot.currency,
      reference,
      customerEmail: row.user.email,
    });

    if (!outcome) {
      report.skipped += 1;
      continue;
    }

    await applyPayment(provider.id, outcome, now);
    if (outcome.status === "approved") report.charged += 1;
    else report.failed += 1;
  }

  return report;
}

/** Plan por defecto, para la interfaz cuando aun no hay suscripcion. */
export const FREE_PLAN: PlanId = DEFAULT_PLAN;
