import "server-only";

import type { BillingProviderId } from "@archvision/billing";
import { getEnv } from "@/lib/env";
import { ManualProvider } from "./manual";
import { WompiProvider } from "./wompi";
import type { BillingProvider } from "./types";

export type { BillingProvider, WebhookEvent, WebhookRequest } from "./types";

const manual = new ManualProvider();
const wompi = new WompiProvider();

/**
 * Pasarela activa.
 *
 * Si la configurada no tiene credenciales, se cae a la simulada en desarrollo
 * y no se cae a ningun sitio en produccion: alli, cobrar mal es peor que no
 * cobrar, asi que la aplicacion prefiere no ofrecer el alta.
 */
export function activeProvider(): BillingProvider | null {
  const configured = getEnv().BILLING_PROVIDER;
  const provider = configured === "wompi" ? wompi : manual;

  if (provider.isConfigured()) return provider;
  if (manual.isConfigured()) return manual;
  return null;
}

export function providerById(id: BillingProviderId): BillingProvider {
  return id === "wompi" ? wompi : manual;
}

/** true cuando se puede contratar desde la aplicacion. */
export function checkoutAvailable(): boolean {
  return activeProvider() !== null;
}
