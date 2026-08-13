import "server-only";

import type { PaymentOutcome, PaymentStatus } from "@archvision/billing";
import { integritySignature, verifyEventChecksum } from "@archvision/billing/signatures";
import { getEnv } from "@/lib/env";
import type { BillingProvider, WebhookEvent, WebhookRequest } from "./types";

/**
 * Wompi (Bancolombia).
 *
 * Cobra en pesos colombianos con tarjeta, PSE, Nequi y Bancolombia. Es la
 * pasarela que puede usar un negocio colombiano como vendedor.
 *
 * DIFERENCIA IMPORTANTE CON OTRAS PASARELAS: Wompi no gestiona suscripciones.
 * Cobra transacciones sueltas. El ciclo de vida (cuando toca renovar, que pasa
 * si un cobro falla, cuando caduca la gracia) lo lleva esta aplicacion en
 * `@archvision/billing`, y aqui solo se ejecutan cobros concretos.
 *
 * Nunca se reciben datos de tarjeta: el pago ocurre en el checkout alojado de
 * Wompi, y para las renovaciones se usa una fuente de pago tokenizada por
 * ellos, de la que solo guardamos su identificador, la marca y los ultimos
 * cuatro digitos.
 */

const CHECKOUT_URL = "https://checkout.wompi.co/p/";

interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  status_message?: string | null;
  payment_source_id?: number | string | null;
  payment_method?: {
    type?: string;
    extra?: { brand?: string; last_four?: string; name?: string };
  } | null;
}

/** Traduce el estado de Wompi al vocabulario de la aplicacion. */
function toStatus(raw: string): PaymentStatus {
  switch (raw.toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "DECLINED":
      return "declined";
    case "VOIDED":
      return "voided";
    case "ERROR":
      return "error";
    default:
      return "pending";
  }
}

function toOutcome(transaction: WompiTransaction): PaymentOutcome {
  const source = transaction.payment_source_id;
  const extra = transaction.payment_method?.extra;

  return {
    reference: transaction.reference,
    status: toStatus(transaction.status),
    amountCents: transaction.amount_in_cents,
    currency: transaction.currency,
    providerPaymentId: transaction.id,
    failureReason: transaction.status_message ?? null,
    paymentSourceId: source === null || source === undefined ? null : String(source),
    cardBrand: extra?.brand ?? null,
    cardLast4: extra?.last_four ?? null,
  };
}

export class WompiProvider implements BillingProvider {
  readonly id = "wompi" as const;

  private get env() {
    return getEnv();
  }

  private get apiBase(): string {
    return this.env.WOMPI_ENVIRONMENT === "production"
      ? "https://production.wompi.co/v1"
      : "https://sandbox.wompi.co/v1";
  }

  isConfigured(): boolean {
    const env = this.env;
    return Boolean(
      env.WOMPI_PUBLIC_KEY && env.WOMPI_PRIVATE_KEY && env.WOMPI_INTEGRITY_SECRET,
    );
  }

  async createCheckout(request: {
    amountCents: number;
    currency: string;
    reference: string;
    customerEmail: string;
    redirectUrl: string;
  }) {
    const env = this.env;
    const signature = integritySignature({
      reference: request.reference,
      amountCents: request.amountCents,
      currency: request.currency,
      secret: env.WOMPI_INTEGRITY_SECRET ?? "",
    });

    const url = new URL(CHECKOUT_URL);
    url.searchParams.set("public-key", env.WOMPI_PUBLIC_KEY ?? "");
    url.searchParams.set("currency", request.currency);
    url.searchParams.set("amount-in-cents", String(request.amountCents));
    url.searchParams.set("reference", request.reference);
    url.searchParams.set("signature:integrity", signature);
    url.searchParams.set("redirect-url", request.redirectUrl);
    url.searchParams.set("customer-data:email", request.customerEmail);

    return { url: url.toString(), reference: request.reference, provider: this.id };
  }

  async parseWebhook(request: WebhookRequest): Promise<WebhookEvent | null> {
    const secret = this.env.WOMPI_EVENTS_SECRET;
    if (!secret) return null;

    let body: {
      event?: string;
      data?: { transaction?: WompiTransaction };
      timestamp?: number;
      sent_at?: string;
      signature?: { properties?: string[]; checksum?: string };
    };

    try {
      body = JSON.parse(request.rawBody);
    } catch {
      return null;
    }

    if (!verifyEventChecksum(body, secret)) return null;

    const transaction = body.data?.transaction;
    if (!transaction) return null;

    return {
      // Wompi no numera los eventos: la transaccion y su estado identifican el
      // hecho, y repetir el mismo estado no debe procesarse dos veces.
      externalId: `${transaction.id}:${transaction.status}`,
      type: body.event ?? "transaction.updated",
      payment: toOutcome(transaction),
    };
  }

  async fetchPayment(
    reference: string,
    providerPaymentId: string | null,
  ): Promise<PaymentOutcome | null> {
    const url = providerPaymentId
      ? `${this.apiBase}/transactions/${providerPaymentId}`
      : `${this.apiBase}/transactions?reference=${encodeURIComponent(reference)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.env.WOMPI_PRIVATE_KEY ?? ""}` },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { data?: WompiTransaction | WompiTransaction[] };
    const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    return data ? toOutcome(data) : null;
  }

  async chargeSavedSource(params: {
    paymentSourceId: string;
    amountCents: number;
    currency: string;
    reference: string;
    customerEmail: string;
  }): Promise<PaymentOutcome | null> {
    const env = this.env;

    const response = await fetch(`${this.apiBase}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WOMPI_PRIVATE_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount_in_cents: params.amountCents,
        currency: params.currency,
        customer_email: params.customerEmail,
        reference: params.reference,
        payment_source_id: Number(params.paymentSourceId),
        signature: integritySignature({
          reference: params.reference,
          amountCents: params.amountCents,
          currency: params.currency,
          secret: env.WOMPI_INTEGRITY_SECRET ?? "",
        }),
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as {
      data?: WompiTransaction;
      error?: { reason?: string };
    } | null;

    if (!response.ok || !payload?.data) {
      return {
        reference: params.reference,
        status: "error",
        amountCents: params.amountCents,
        currency: params.currency,
        providerPaymentId: null,
        failureReason: payload?.error?.reason ?? `HTTP ${response.status}`,
      };
    }

    return toOutcome(payload.data);
  }
}
