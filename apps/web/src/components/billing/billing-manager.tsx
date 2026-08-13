"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { formatMoney, type BillingInterval, type PlanId } from "@archvision/config";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { PlanCards } from "./plan-cards";
import { cn } from "@/lib/utils";

/**
 * Gestion de la suscripcion.
 *
 * Cuatro cosas y ninguna mas: en que plan estas, hasta cuando, como cambiarlo
 * y que se te ha cobrado. Los datos de tarjeta no aparecen porque no los
 * tenemos: lo unico que guardamos del medio de pago son la marca y los cuatro
 * ultimos digitos que devuelve la pasarela.
 */

interface SubscriptionView {
  plan: PlanId;
  status: string;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  paymentSourceId: string | null;
}

interface PaymentView {
  id: string;
  reference: string;
  status: string;
  amountCents: number;
  currency: string;
  description: string;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface Props {
  currentPlan: PlanId;
  reason: string;
  graceDaysLeft: number;
  subscription: SubscriptionView | null;
  payments: PaymentView[];
  checkoutAvailable: boolean;
  providerId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  incomplete: "Pendiente de pago",
  trialing: "En periodo de prueba",
  active: "Al dia",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Pagado",
  declined: "Rechazado",
  voided: "Anulado",
  error: "Error",
  refunded: "Devuelto",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BillingManager(props: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { subscription } = props;

  async function call(
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
  ): Promise<{ ok: boolean; data?: { url?: string }; message?: string }> {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: { url?: string };
      error?: { message?: string };
    } | null;

    return {
      ok: response.ok,
      data: payload?.data,
      message: payload?.error?.message,
    };
  }

  async function checkout(plan: PlanId, interval: BillingInterval) {
    setError(null);
    const result = await call("/api/billing/checkout", "POST", { plan, interval });

    if (!result.ok || !result.data?.url) {
      setError(result.message ?? "No fue posible iniciar el pago");
      return;
    }

    // El cobro ocurre fuera de la aplicacion: aqui solo se acompana al usuario
    // hasta la pasarela.
    window.location.href = result.data.url;
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    const result = await call("/api/billing/subscription", "DELETE");
    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? "No fue posible cancelar");
      return;
    }
    router.refresh();
  }

  async function resume() {
    setBusy(true);
    setError(null);
    const result = await call("/api/billing/subscription", "POST");
    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? "No fue posible reanudar");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {props.reason === "impago-en-gracia" ? (
        <div className="flex items-start gap-2 rounded-panel border border-warn/50 bg-warn/10 p-4 text-xs text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <div>
            <p className="font-medium">No pudimos cobrar tu ultima renovacion.</p>
            <p className="mt-1 text-ink-muted">
              Conservas el plan {props.currentPlan} durante{" "}
              {props.graceDaysLeft} dia(s) mas. Vuelve a contratar el plan para
              regularizarlo; si el cargo falla por la tarjeta, tu banco suele
              indicar el motivo.
            </p>
          </div>
        </div>
      ) : null}

      {subscription ? (
        <Panel>
          <PanelHeader
            title="Tu suscripcion"
            description={STATUS_LABEL[subscription.status] ?? subscription.status}
          />
          <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
            <div className="bg-surface px-4 py-3">
              <dt className="text-[11px] text-ink-subtle">Plan</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {subscription.plan}{" "}
                <span className="text-ink-subtle">
                  ({subscription.interval === "year" ? "anual" : "mensual"})
                </span>
              </dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-[11px] text-ink-subtle">Importe</dt>
              <dd className="mt-0.5 font-mono text-sm text-ink">
                {formatMoney(subscription.amountCents, subscription.currency)}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-[11px] text-ink-subtle">
                {subscription.cancelAtPeriodEnd ? "Activo hasta" : "Se renueva el"}
              </dt>
              <dd className="mt-0.5 text-sm text-ink">
                {formatDate(subscription.currentPeriodEnd)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <CreditCard className="size-3.5" aria-hidden />
              {subscription.cardLast4
                ? `${subscription.cardBrand ?? "Tarjeta"} ····${subscription.cardLast4}`
                : "Sin medio de pago guardado"}
            </p>

            <div className="ml-auto flex gap-2">
              {subscription.cancelAtPeriodEnd ? (
                <Button size="sm" variant="outline" onClick={resume} disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  Reanudar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  Cancelar renovacion
                </Button>
              )}
            </div>
          </div>

          {!subscription.paymentSourceId && !subscription.cancelAtPeriodEnd ? (
            <p className="border-t border-line px-4 py-3 text-[11px] text-ink-subtle">
              No hay medio de pago guardado, asi que la proxima renovacion no se
              cobrara sola: te avisaremos para que la pagues desde aqui.
            </p>
          ) : null}
        </Panel>
      ) : null}

      {error ? (
        <p className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <h2 className="pb-1 text-sm font-semibold text-ink">Planes</h2>
        <p className="pb-4 text-xs text-ink-muted">
          El cambio de plan se cobra al contratarlo y el periodo en curso se
          respeta. Los precios estan en pesos colombianos.
        </p>
        <PlanCards
          currentPlan={props.currentPlan}
          onSelect={checkout}
          checkoutAvailable={props.checkoutAvailable}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Historial de cobros"
          description="Lo que la pasarela ha intentado cobrar"
        />
        {props.payments.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-ink-subtle">
            Todavia no hay movimientos.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {props.payments.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink">{payment.description}</p>
                  <p className="truncate font-mono text-[10px] text-ink-subtle">
                    {formatDate(payment.paidAt ?? payment.createdAt)} · {payment.reference}
                  </p>
                  {payment.failureReason ? (
                    <p className="text-[10px] text-danger">{payment.failureReason}</p>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-ink">
                  {formatMoney(payment.amountCents, payment.currency)}
                </span>
                <span
                  className={cn(
                    "w-20 shrink-0 text-right text-[10px]",
                    payment.status === "approved"
                      ? "text-ok"
                      : payment.status === "pending"
                        ? "text-ink-subtle"
                        : "text-danger",
                  )}
                >
                  {PAYMENT_LABEL[payment.status] ?? payment.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {props.providerId === "manual" ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <ExternalLink className="size-3" aria-hidden />
          Pasarela en modo simulacion: los cobros no son reales y solo funcionan
          fuera de produccion.
        </p>
      ) : null}
    </div>
  );
}
