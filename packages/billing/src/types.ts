import type { BillingInterval, PlanId } from "@archvision/config";

/**
 * Contratos de facturacion.
 *
 * Este paquete es puro: no habla con la pasarela, no toca la base de datos y no
 * usa `Date.now()` sin que se lo pasen. Todo lo que decide (que plan da derecho
 * a que, cuando vence un periodo, que pasa tras un cobro rechazado) se puede
 * probar sin red y sin reloj.
 */

export type SubscriptionStatus =
  /** Alta iniciada, sin primer pago aprobado todavia. */
  | "incomplete"
  /** Periodo de prueba en curso. */
  | "trialing"
  /** Al dia. */
  | "active"
  /** Un cobro fallo; el servicio sigue durante el periodo de gracia. */
  | "past_due"
  /** Terminada: por baja del usuario o por gracia agotada. */
  | "canceled";

export type BillingProviderId = "manual" | "wompi";

/** Estado de una suscripcion, sin depender de Prisma. */
export interface SubscriptionSnapshot {
  plan: PlanId;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  amountCents: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
  /** Cuando empezo el impago. Marca el inicio del periodo de gracia. */
  pastDueSince: Date | null;
  /** Medio de pago guardado para renovar; sin el no hay cobro automatico. */
  paymentSourceId: string | null;
}

export type PaymentStatus =
  | "pending"
  | "approved"
  | "declined"
  | "voided"
  | "error"
  | "refunded";

/** Resultado de un intento de cobro, ya normalizado desde la pasarela. */
export interface PaymentOutcome {
  reference: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  providerPaymentId: string | null;
  failureReason: string | null;
  /** Medio de pago tokenizado que la pasarela devuelve, si lo hay. */
  paymentSourceId?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
}

/** Lo que hay que saber para iniciar un pago. */
export interface CheckoutRequest {
  plan: PlanId;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  reference: string;
  customerEmail: string;
  /** A donde vuelve el usuario tras pagar. */
  redirectUrl: string;
}

export interface CheckoutSession {
  /** URL a la que se envia al usuario. El cobro ocurre fuera de la aplicacion. */
  url: string;
  reference: string;
  provider: BillingProviderId;
}
