import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import {
  BillingError,
  billingOverview,
  cancelSubscription,
  resumeSubscriptionFor,
} from "@/lib/billing/service";

/** GET /api/billing/subscription — estado, derechos y ultimos cobros. */
export async function GET() {
  return withErrorHandling("billing.overview", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    return apiSuccess(await billingOverview(user.id));
  });
}

/**
 * DELETE /api/billing/subscription — baja.
 *
 * No corta el servicio: lo pagado se conserva hasta el final del periodo.
 */
export async function DELETE() {
  return withErrorHandling("billing.cancel", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    try {
      const subscription = await cancelSubscription(user.id);
      return apiSuccess({
        status: subscription.status,
        activeUntil: subscription.currentPeriodEnd,
      });
    } catch (error) {
      if (error instanceof BillingError) {
        return apiError("BAD_REQUEST", error.message);
      }
      throw error;
    }
  });
}

/** POST /api/billing/subscription — deshacer una baja pendiente. */
export async function POST() {
  return withErrorHandling("billing.resume", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    try {
      const subscription = await resumeSubscriptionFor(user.id);
      return apiSuccess({
        status: subscription.status,
        renewsAt: subscription.currentPeriodEnd,
      });
    } catch (error) {
      if (error instanceof BillingError) {
        return apiError("BAD_REQUEST", error.message);
      }
      throw error;
    }
  });
}
