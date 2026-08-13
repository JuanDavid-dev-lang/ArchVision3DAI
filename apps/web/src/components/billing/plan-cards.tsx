"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  PRICING,
  formatMoney,
  planLimits,
  priceFor,
  yearlySavingCents,
  type BillingInterval,
  type PlanId,
} from "@archvision/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tabla de planes.
 *
 * Se usa en la landing y en la pantalla de facturacion. Es la misma tabla a
 * proposito: el precio que se promete antes de registrarse y el que se cobra
 * despues salen del mismo catalogo, y no pueden discrepar.
 *
 * El ciclo anual se muestra con el ahorro en pesos, no en porcentaje: "dos
 * meses gratis" se entiende sin hacer cuentas.
 */

const ORDER: PlanId[] = ["free", "pro", "studio", "enterprise"];

interface Props {
  /** Plan que rige ahora mismo, para marcarlo y no ofrecer contratarlo. */
  currentPlan?: PlanId;
  /** Ausente en la landing: alli el boton lleva al registro. */
  onSelect?: (plan: PlanId, interval: BillingInterval) => Promise<void> | void;
  /** false cuando no hay pasarela: se explica en vez de fallar al pulsar. */
  checkoutAvailable?: boolean;
  registerHref?: string;
}

export function PlanCards({
  currentPlan,
  onSelect,
  checkoutAvailable = true,
  registerHref = "/register",
}: Props) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<PlanId | null>(null);

  return (
    <div>
      <div className="flex items-center justify-center gap-1 pb-6">
        {(["month", "year"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setInterval(option)}
            aria-pressed={interval === option}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              interval === option
                ? "bg-accent text-accent-ink"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {option === "month" ? "Mensual" : "Anual"}
          </button>
        ))}
        {interval === "year" ? (
          <span className="ml-2 text-[11px] text-accent">
            Dos meses gratis en cada plan
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((planId) => {
          const pricing = PRICING[planId];
          const limits = planLimits(planId);
          const price = priceFor(planId, interval);
          const saving = interval === "year" ? yearlySavingCents(planId) : 0;
          const isCurrent = currentPlan === planId;
          const purchasable = Boolean(price && price.amountCents > 0);

          return (
            <article
              key={planId}
              className={cn(
                "flex h-full flex-col rounded-panel border bg-surface p-5",
                pricing.featured ? "border-accent shadow-lg" : "border-line",
              )}
            >
              <header>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{limits.label}</h3>
                  {isCurrent ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                      Tu plan
                    </span>
                  ) : pricing.featured ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                      Recomendado
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle">
                  {pricing.tagline}
                </p>

                <div className="mt-4">
                  {pricing.contactOnly ? (
                    <p className="text-lg font-semibold text-ink">A convenir</p>
                  ) : (
                    <>
                      <p className="text-2xl font-semibold tracking-tight text-ink">
                        {formatMoney(price?.amountCents ?? 0, pricing.currency)}
                      </p>
                      <p className="text-[11px] text-ink-subtle">
                        {price?.amountCents === 0
                          ? "Para siempre"
                          : interval === "year"
                            ? "al ano, IVA incluido"
                            : "al mes, IVA incluido"}
                      </p>
                      {saving > 0 ? (
                        <p className="mt-0.5 text-[11px] text-accent">
                          Ahorras {formatMoney(saving, pricing.currency)}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </header>

              <ul className="mt-4 flex-1 space-y-1.5 text-[11px] text-ink-muted">
                {pricing.highlights.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <Check className="mt-0.5 size-3 shrink-0 text-accent" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <footer className="mt-5">
                {pricing.contactOnly ? (
                  <a href="mailto:ventas@archvision.app">
                    <Button variant="outline" className="w-full justify-center">
                      Hablar con ventas
                    </Button>
                  </a>
                ) : !onSelect ? (
                  <a href={registerHref}>
                    <Button
                      variant={pricing.featured ? "primary" : "outline"}
                      className="w-full justify-center"
                    >
                      {purchasable ? "Empezar" : "Crear cuenta"}
                    </Button>
                  </a>
                ) : isCurrent ? (
                  <Button variant="outline" className="w-full justify-center" disabled>
                    Plan actual
                  </Button>
                ) : !purchasable ? (
                  <Button variant="outline" className="w-full justify-center" disabled>
                    Incluido al registrarse
                  </Button>
                ) : (
                  <Button
                    variant={pricing.featured ? "primary" : "outline"}
                    className="w-full justify-center"
                    disabled={!checkoutAvailable || busy !== null}
                    onClick={async () => {
                      setBusy(planId);
                      try {
                        await onSelect(planId, interval);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === planId ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {currentPlan && currentPlan !== "free" ? "Cambiar a este" : "Contratar"}
                  </Button>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      {onSelect && !checkoutAvailable ? (
        <p className="pt-4 text-center text-[11px] text-ink-subtle">
          El cobro no esta disponible ahora mismo: falta configurar la pasarela.
          Escribe a soporte y lo activamos.
        </p>
      ) : null}
    </div>
  );
}
