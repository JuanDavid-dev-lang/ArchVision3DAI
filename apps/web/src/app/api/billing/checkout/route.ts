import { checkoutRequestSchema } from "@archvision/validation";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  readJsonBody,
  withErrorHandling,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { clientKey, consume } from "@/lib/api/rate-limit";
import { BillingError, startCheckout } from "@/lib/billing/service";

/**
 * POST /api/billing/checkout
 *
 * Devuelve la URL de pago. No concede el plan: el derecho llega cuando la
 * pasarela confirma el cobro en el webhook.
 *
 * El importe se lee del catalogo en el servidor. Si viniera del cliente, un
 * usuario podria contratar el plan Studio por mil pesos cambiando el cuerpo de
 * la peticion.
 */
export async function POST(request: Request) {
  return withErrorHandling("billing.checkout", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    // Cada intento crea una suscripcion y un cobro pendiente: sin limite, un
    // bucle llenaria la tabla de pagos y el panel de la pasarela.
    const limit = consume(`${clientKey(request, "checkout")}:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Demasiados intentos seguidos. Espera ${limit.retryAfterSeconds} s.`,
      );
    }

    const body = await readJsonBody(request, 4 * 1024);
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    try {
      const result = await startCheckout(user.id, parsed.data);
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof BillingError) {
        return apiError(
          error.code === "PROVIDER_UNAVAILABLE" ? "INTERNAL" : "BAD_REQUEST",
          error.message,
        );
      }
      throw error;
    }
  });
}
