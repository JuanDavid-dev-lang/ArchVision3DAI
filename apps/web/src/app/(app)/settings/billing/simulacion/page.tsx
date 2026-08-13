import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@archvision/config";
import { requirePageUser } from "@/lib/auth/guards";
import { isProduction } from "@/lib/env";
import { signSimulation } from "@/lib/billing/providers/manual";
import { SimulationActions } from "@/components/billing/simulation-actions";

export const metadata: Metadata = { title: "Simulacion de pago" };

/**
 * Pasarela simulada.
 *
 * Ocupa el lugar del checkout real mientras no hay credenciales. Ofrece las
 * dos salidas de un cobro, aprobado y rechazado, porque el camino que se rompe
 * en produccion es casi siempre el segundo y es el que nadie prueba.
 *
 * No existe en produccion: alli, conceder un plan sin cobrar seria un fallo de
 * facturacion.
 */
export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; amount?: string; plan?: string }>;
}) {
  await requirePageUser();
  if (isProduction()) notFound();

  const params = await searchParams;
  const reference = params.reference ?? "";
  if (!reference) notFound();

  const amountCents = Number(params.amount ?? "0");

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pasarela simulada</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Aqui iria el checkout de Wompi. Elige como termina el cobro para
          probar el flujo completo, incluido el que falla.
        </p>
      </div>

      <dl className="rounded-panel border border-line bg-surface p-4 text-xs">
        <div className="flex justify-between py-1">
          <dt className="text-ink-subtle">Plan</dt>
          <dd className="text-ink">{params.plan ?? "-"}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-ink-subtle">Importe</dt>
          <dd className="font-mono text-ink">
            {Number.isFinite(amountCents) ? formatMoney(amountCents) : "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="shrink-0 text-ink-subtle">Referencia</dt>
          <dd className="truncate font-mono text-[10px] text-ink-subtle">{reference}</dd>
        </div>
      </dl>

      {/*
        Las firmas se calculan en el servidor y viajan al cliente ya hechas: el
        evento simulado entra por el mismo webhook y pasa la misma verificacion
        que uno real, que es lo unico que hace util esta pantalla.
      */}
      <SimulationActions
        reference={reference}
        approveSignature={signSimulation(reference, true)}
        declineSignature={signSimulation(reference, false)}
      />
    </div>
  );
}
