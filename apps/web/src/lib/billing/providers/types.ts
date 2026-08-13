import "server-only";

import type {
  BillingProviderId,
  CheckoutRequest,
  CheckoutSession,
  PaymentOutcome,
} from "@archvision/billing";

/**
 * Contrato de una pasarela.
 *
 * Todo lo especifico de cada proveedor vive detras de esta interfaz: firmas,
 * nombres de campo, codigos de estado. El servicio de facturacion trabaja solo
 * con `PaymentOutcome`, de modo que cambiar de pasarela o anadir una segunda
 * para otro pais no toca la logica de negocio.
 *
 * Ninguna implementacion recibe, guarda ni reenvia datos de tarjeta. El cobro
 * ocurre en la pasarela; aqui viajan importes, referencias e identificadores.
 */

export interface WebhookRequest {
  /** Cuerpo crudo, sin parsear: la firma se calcula sobre los bytes recibidos. */
  rawBody: string;
  headers: Headers;
}

export interface WebhookEvent {
  /** Identificador del evento en la pasarela, para descartar repeticiones. */
  externalId: string;
  type: string;
  payment: PaymentOutcome | null;
}

export interface BillingProvider {
  readonly id: BillingProviderId;
  /** true cuando hay credenciales suficientes para operar. */
  isConfigured(): boolean;
  /** Devuelve la URL a la que se envia al usuario para pagar. */
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Comprueba la firma y traduce el evento. Devuelve null si la firma no
   * cuadra: un evento sin verificar no se procesa nunca.
   */
  parseWebhook(request: WebhookRequest): Promise<WebhookEvent | null>;
  /** Consulta el estado real de un cobro en la pasarela. */
  fetchPayment(reference: string, providerPaymentId: string | null): Promise<PaymentOutcome | null>;
  /**
   * Cobra una renovacion con el medio de pago guardado. `null` cuando la
   * pasarela no permite cobrar sin intervencion del usuario.
   */
  chargeSavedSource(params: {
    paymentSourceId: string;
    amountCents: number;
    currency: string;
    reference: string;
    customerEmail: string;
  }): Promise<PaymentOutcome | null>;
}
