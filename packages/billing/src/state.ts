import type { BillingInterval, PlanId } from "@archvision/config";
import { nextPeriod, periodEnd } from "./periods";
import type { PaymentOutcome, SubscriptionSnapshot } from "./types";

/**
 * Transiciones de la suscripcion.
 *
 * Funciones puras que reciben el estado y devuelven el siguiente. Cobrar es lo
 * unico que cambia dinero de sitio, pero decidir que significa un cobro para
 * el servicio es una regla de negocio, y conviene poder leerla entera y
 * probarla sin pasarela.
 */

/** Suscripcion recien creada, todavia sin pagar. */
export function startSubscription(params: {
  plan: PlanId;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  now: Date;
  trialDays?: number;
}): SubscriptionSnapshot {
  const { plan, interval, amountCents, currency, now } = params;
  const trialDays = params.trialDays ?? 0;

  if (trialDays > 0) {
    const trialEnd = new Date(now.getTime() + trialDays * 86_400_000);
    return {
      plan,
      status: "trialing",
      interval,
      currency,
      amountCents,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: trialEnd,
      pastDueSince: null,
      paymentSourceId: null,
    };
  }

  return {
    plan,
    status: "incomplete",
    interval,
    currency,
    amountCents,
    currentPeriodStart: now,
    // Sin pago no hay servicio: el periodo nace ya vencido y solo lo abre el
    // primer cobro aprobado.
    currentPeriodEnd: now,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    pastDueSince: null,
    paymentSourceId: null,
  };
}

/**
 * Cobro aprobado.
 *
 * Abre el primer periodo o encadena el siguiente, limpia el impago y guarda el
 * medio de pago cuando la pasarela lo devuelve, que es lo que permite renovar
 * sin volver a molestar al cliente.
 */
export function applyApprovedPayment(
  subscription: SubscriptionSnapshot,
  payment: PaymentOutcome,
  now: Date,
): SubscriptionSnapshot {
  const anchorDay = subscription.currentPeriodStart.getUTCDate();

  const period =
    subscription.status === "incomplete"
      ? { start: now, end: periodEnd(now, subscription.interval, now.getUTCDate()) }
      : nextPeriod(subscription.currentPeriodEnd, subscription.interval, now, anchorDay);

  // Una baja pendiente se cumple aqui: si el usuario pidio no renovar, un
  // cobro aprobado no debe resucitar la suscripcion.
  if (subscription.cancelAtPeriodEnd) {
    return { ...subscription, pastDueSince: null };
  }

  return {
    ...subscription,
    status: "active",
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    pastDueSince: null,
    trialEndsAt: null,
    paymentSourceId: payment.paymentSourceId ?? subscription.paymentSourceId,
  };
}

/**
 * Cobro rechazado.
 *
 * Empieza a contar la gracia solo la primera vez: reintentar tres veces en una
 * semana no puede reiniciar el plazo, o el impago no vencería nunca.
 */
export function applyFailedPayment(
  subscription: SubscriptionSnapshot,
  now: Date,
): SubscriptionSnapshot {
  if (subscription.status === "incomplete") return subscription;

  return {
    ...subscription,
    status: "past_due",
    pastDueSince: subscription.pastDueSince ?? now,
  };
}

/**
 * Baja pedida por el usuario.
 *
 * No corta el servicio: se conserva hasta el final de lo pagado. Cobrar un mes
 * y quitarlo el mismo dia es lo que convierte una baja en una reclamacion.
 */
export function requestCancel(
  subscription: SubscriptionSnapshot,
  now: Date,
): SubscriptionSnapshot {
  return {
    ...subscription,
    status: "canceled",
    cancelAtPeriodEnd: true,
    canceledAt: now,
  };
}

/** Deshacer la baja mientras el periodo siga vivo. */
export function resumeSubscription(
  subscription: SubscriptionSnapshot,
  now: Date,
): SubscriptionSnapshot | null {
  if (!subscription.cancelAtPeriodEnd) return subscription;
  if (subscription.currentPeriodEnd.getTime() <= now.getTime()) return null;

  return {
    ...subscription,
    status: subscription.pastDueSince ? "past_due" : "active",
    cancelAtPeriodEnd: false,
    canceledAt: null,
  };
}

/** Cambio de plan o de ciclo. El nuevo precio rige desde el proximo cobro. */
export function changePlan(
  subscription: SubscriptionSnapshot,
  params: { plan: PlanId; interval: BillingInterval; amountCents: number },
): SubscriptionSnapshot {
  return {
    ...subscription,
    plan: params.plan,
    interval: params.interval,
    amountCents: params.amountCents,
    cancelAtPeriodEnd: false,
    canceledAt: null,
  };
}

/**
 * Suscripciones que toca cobrar.
 *
 * Se cobra cuando el periodo ya vencio, no antes: adelantar el cargo es cobrar
 * un servicio que todavia no se ha prestado.
 */
export function isDueForRenewal(
  subscription: SubscriptionSnapshot,
  now: Date,
): boolean {
  if (subscription.cancelAtPeriodEnd) return false;
  if (subscription.status !== "active" && subscription.status !== "past_due") {
    return false;
  }
  if (!subscription.paymentSourceId) return false;
  return subscription.currentPeriodEnd.getTime() <= now.getTime();
}

/** Impago con la gracia agotada: se termina la suscripcion. */
export function expireIfGraceOver(
  subscription: SubscriptionSnapshot,
  now: Date,
  graceDays: number,
): SubscriptionSnapshot | null {
  if (subscription.status !== "past_due" || !subscription.pastDueSince) return null;

  const limit = new Date(subscription.pastDueSince.getTime() + graceDays * 86_400_000);
  if (limit.getTime() > now.getTime()) return null;

  return {
    ...subscription,
    status: "canceled",
    canceledAt: now,
    cancelAtPeriodEnd: true,
  };
}
