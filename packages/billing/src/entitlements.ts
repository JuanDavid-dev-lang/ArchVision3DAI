import { DEFAULT_PLAN, planLimits, type PlanId, type PlanLimits } from "@archvision/config";
import { daysLeft } from "./periods";
import type { SubscriptionSnapshot } from "./types";

/**
 * De la suscripcion a los limites.
 *
 * Una sola funcion decide que plan rige, y el resto de la aplicacion la usa en
 * vez de mirar el estado por su cuenta. Si el criterio cambia (por ejemplo la
 * duracion de la gracia), cambia en un sitio.
 */

/**
 * Dias de servicio tras un cobro fallido.
 *
 * Cortar el acceso el mismo dia castiga al cliente por una tarjeta vencida o
 * un banco caido, que es la causa mas frecuente. Una semana da tiempo a
 * reaccionar sin regalar un mes.
 */
export const GRACE_DAYS = 7;

export interface Entitlement {
  plan: PlanId;
  limits: PlanLimits;
  /** true cuando el plan viene de una suscripcion viva y no del plan gratuito. */
  paid: boolean;
  /** Dias de gracia que quedan, si esta en impago. */
  graceDaysLeft: number;
  /** Motivo por el que se aplica este plan; se muestra tal cual al usuario. */
  reason:
    | "sin-suscripcion"
    | "activa"
    | "prueba"
    | "impago-en-gracia"
    | "gracia-agotada"
    | "cancelada"
    | "periodo-vencido";
}

/** Fin del periodo de gracia de una suscripcion en impago. */
export function graceEndsAt(subscription: SubscriptionSnapshot): Date | null {
  if (!subscription.pastDueSince) return null;
  const end = new Date(subscription.pastDueSince);
  end.setUTCDate(end.getUTCDate() + GRACE_DAYS);
  return end;
}

/**
 * Plan efectivo de un usuario.
 *
 * `null` significa que nunca hubo suscripcion, que no es lo mismo que una
 * cancelada: ambas dan el plan gratuito, pero la interfaz cuenta cosas
 * distintas en cada caso.
 */
export function entitlementOf(
  subscription: SubscriptionSnapshot | null,
  now: Date,
): Entitlement {
  const free = (reason: Entitlement["reason"]): Entitlement => ({
    plan: DEFAULT_PLAN,
    limits: planLimits(DEFAULT_PLAN),
    paid: false,
    graceDaysLeft: 0,
    reason,
  });

  if (!subscription) return free("sin-suscripcion");

  const granted = (reason: Entitlement["reason"], graceDaysLeft = 0): Entitlement => ({
    plan: subscription.plan,
    limits: planLimits(subscription.plan),
    paid: true,
    graceDaysLeft,
    reason,
  });

  switch (subscription.status) {
    case "trialing": {
      const ends = subscription.trialEndsAt ?? subscription.currentPeriodEnd;
      return ends.getTime() > now.getTime()
        ? granted("prueba")
        : free("periodo-vencido");
    }

    case "active": {
      // El periodo vencido sin renovacion registrada no da derecho a nada: es
      // la red que evita regalar el servicio si un evento de cobro se pierde.
      return subscription.currentPeriodEnd.getTime() > now.getTime()
        ? granted("activa")
        : free("periodo-vencido");
    }

    case "past_due": {
      const end = graceEndsAt(subscription);
      if (!end || end.getTime() <= now.getTime()) return free("gracia-agotada");
      return granted("impago-en-gracia", daysLeft(end, now));
    }

    case "canceled": {
      // Una baja pedida a mitad de periodo conserva el servicio hasta el final:
      // esta pagado.
      return subscription.currentPeriodEnd.getTime() > now.getTime()
        ? granted("activa")
        : free("cancelada");
    }

    case "incomplete":
    default:
      return free("sin-suscripcion");
  }
}

/** Atajo para el caso mas comun: solo el identificador del plan. */
export function effectivePlan(
  subscription: SubscriptionSnapshot | null,
  now: Date,
): PlanId {
  return entitlementOf(subscription, now).plan;
}
