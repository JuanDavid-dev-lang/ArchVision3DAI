import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/guards";
import { billingOverview } from "@/lib/billing/service";
import { BillingManager } from "@/components/billing/billing-manager";

export const metadata: Metadata = { title: "Facturacion" };

/**
 * Facturacion.
 *
 * El estado se calcula en el servidor a partir de la suscripcion, nunca de lo
 * que traiga el navegador: es la misma fuente que decide si se puede crear el
 * proyecto numero cuatro.
 */
export default async function BillingPage() {
  const user = await requirePageUser();
  const overview = await billingOverview(user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Facturacion</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Plan, cobros y renovacion. Puedes cancelar cuando quieras y conservas
          lo pagado hasta el final del periodo.
        </p>
      </div>

      <BillingManager
        currentPlan={overview.entitlement.plan}
        reason={overview.entitlement.reason}
        graceDaysLeft={overview.entitlement.graceDaysLeft}
        subscription={
          overview.subscription
            ? {
                plan: overview.subscription.plan,
                status: overview.subscription.status,
                interval: overview.subscription.interval,
                amountCents: overview.subscription.amountCents,
                currency: overview.subscription.currency,
                currentPeriodEnd: overview.subscription.currentPeriodEnd.toISOString(),
                cancelAtPeriodEnd: overview.subscription.cancelAtPeriodEnd,
                cardBrand: overview.subscription.cardBrand,
                cardLast4: overview.subscription.cardLast4,
                paymentSourceId: overview.subscription.paymentSourceId,
              }
            : null
        }
        payments={overview.payments.map((payment) => ({
          ...payment,
          paidAt: payment.paidAt?.toISOString() ?? null,
          createdAt: payment.createdAt.toISOString(),
        }))}
        checkoutAvailable={overview.checkoutAvailable}
        providerId={overview.providerId}
      />
    </div>
  );
}
