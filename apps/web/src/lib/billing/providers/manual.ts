import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, PaymentOutcome } from "@archvision/billing";
import { getEnv, isProduction } from "@/lib/env";
import type { BillingProvider, WebhookEvent, WebhookRequest } from "./types";

/**
 * Pasarela simulada.
 *
 * Existe para poder desarrollar y probar el ciclo completo (alta, cobro,
 * renovacion, impago, baja) sin credenciales y sin red. El "checkout" es una
 * pantalla propia donde se elige si el cobro se aprueba o se rechaza, que es
 * justo lo que hace falta para probar el camino que casi nunca se prueba: el
 * del pago fallido.
 *
 * No cobra nada. Por eso se apaga sola en produccion: alli, un plan de pago
 * concedido sin cobro seria un fallo de facturacion, no una comodidad.
 */

export class ManualProvider implements BillingProvider {
  readonly id = "manual" as const;

  isConfigured(): boolean {
    return !isProduction();
  }

  async createCheckout(request: CheckoutRequest) {
    const base = getEnv().NEXT_PUBLIC_APP_URL;
    const url = new URL("/settings/billing/simulacion", base);
    url.searchParams.set("reference", request.reference);
    url.searchParams.set("amount", String(request.amountCents));
    url.searchParams.set("plan", request.plan);

    return { url: url.toString(), reference: request.reference, provider: this.id };
  }

  /**
   * La simulacion firma su propio evento con `AUTH_SECRET`.
   *
   * Aunque no haya dinero de por medio, el camino tiene que ser el mismo: si
   * el evento simulado no pasara por la misma verificacion, la prueba no
   * estaria probando el codigo que corre en produccion.
   */
  async parseWebhook(request: WebhookRequest): Promise<WebhookEvent | null> {
    if (!this.isConfigured()) return null;

    let body: { reference?: string; approve?: boolean; signature?: string };
    try {
      body = JSON.parse(request.rawBody);
    } catch {
      return null;
    }

    if (!body.reference || typeof body.signature !== "string") return null;

    const expected = signSimulation(body.reference, body.approve === true);
    const received = Buffer.from(body.signature, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
      return null;
    }

    const approved = body.approve === true;

    return {
      externalId: `manual:${body.reference}:${approved ? "approved" : "declined"}`,
      type: approved ? "transaction.approved" : "transaction.declined",
      payment: {
        reference: body.reference,
        status: approved ? "approved" : "declined",
        amountCents: 0,
        currency: "COP",
        providerPaymentId: `sim-${body.reference}`,
        failureReason: approved ? null : "Rechazo simulado",
        // Una simulacion aprobada deja medio de pago para poder probar
        // tambien la renovacion automatica.
        paymentSourceId: approved ? `sim-source-${body.reference}` : null,
        cardBrand: approved ? "VISA" : null,
        cardLast4: approved ? "4242" : null,
      },
    };
  }

  async fetchPayment(): Promise<PaymentOutcome | null> {
    return null;
  }

  async chargeSavedSource(params: {
    paymentSourceId: string;
    amountCents: number;
    currency: string;
    reference: string;
  }): Promise<PaymentOutcome | null> {
    if (!this.isConfigured()) return null;

    return {
      reference: params.reference,
      status: "approved",
      amountCents: params.amountCents,
      currency: params.currency,
      providerPaymentId: `sim-${params.reference}`,
      failureReason: null,
      paymentSourceId: params.paymentSourceId,
    };
  }
}

/** Firma de un evento simulado. Se usa en la pantalla de simulacion. */
export function signSimulation(reference: string, approve: boolean): string {
  return createHmac("sha256", getEnv().AUTH_SECRET)
    .update(`${reference}:${approve ? "1" : "0"}`)
    .digest("hex");
}
