import { z } from "zod";

/**
 * Entradas de facturacion.
 *
 * El plan y el ciclo llegan del cliente y deciden cuanto se cobra, asi que se
 * validan contra la lista cerrada antes de tocar un precio. El importe NUNCA
 * viaja desde el navegador: se lee del catalogo en el servidor.
 */

export const purchasablePlanSchema = z.enum(["pro", "studio"]);
export const billingIntervalSchema = z.enum(["month", "year"]);

export const checkoutRequestSchema = z.object({
  plan: purchasablePlanSchema,
  interval: billingIntervalSchema.default("month"),
});

export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
