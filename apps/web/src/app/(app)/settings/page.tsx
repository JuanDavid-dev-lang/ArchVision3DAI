import type { Metadata } from "next";
import Link from "next/link";
import { planLimits } from "@archvision/config";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { requirePageUser } from "@/lib/auth/guards";
import { getWorkspaceStats } from "@/lib/projects/service";
import { currentEntitlement } from "@/lib/billing/service";
import { formatBytes } from "@/lib/utils";

export const metadata: Metadata = { title: "Configuracion" };

export default async function SettingsPage() {
  const user = await requirePageUser();
  const stats = await getWorkspaceStats(user.id);
  // El plan efectivo sale de la suscripcion, no de la copia en la sesion: una
  // suscripcion vencida deja de dar limites aunque nadie haya tocado nada.
  const entitlement = await currentEntitlement(user.id);
  const limits = planLimits(entitlement.plan);

  const usage = [
    [
      "Proyectos",
      `${stats.projects} / ${limits.maxProjects < 0 ? "ilimitados" : limits.maxProjects}`,
    ],
    [
      "Almacenamiento",
      `${formatBytes(stats.storageBytes)} / ${
        limits.maxStorageBytes < 0 ? "ilimitado" : formatBytes(limits.maxStorageBytes)
      }`,
    ],
    [
      "Analisis IA / mes",
      limits.aiAnalysesPerMonth < 0 ? "ilimitados" : String(limits.aiAnalysesPerMonth),
    ],
    ["Resolucion maxima de render", `${limits.maxRenderResolution} px`],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuracion</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Plan, consumo y preferencias de la cuenta.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title={`Plan ${limits.label}`}
          description="Limites aplicados en el servidor"
          action={
            <Link
              href="/settings/billing"
              className="text-xs text-accent hover:underline"
            >
              Gestionar plan
            </Link>
          }
        />
        <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
          {usage.map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3">
              <dt className="text-[11px] text-ink-subtle">{label}</dt>
              <dd className="mt-0.5 font-mono text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <PanelHeader
          title="Privacidad"
          description="Control sobre tus datos"
        />
        <div className="space-y-3 p-4 text-xs leading-relaxed text-ink-muted">
          <p>
            Puedes eliminar de forma permanente proyectos, imagenes y
            reconstrucciones desde la papelera. El borrado definitivo elimina
            tambien los archivos originales del almacenamiento.
          </p>
          <p>
            La telemetria de producto es opcional y nunca incluye contenido de
            tus proyectos. Se habilitara junto con el panel administrativo.
          </p>
        </div>
      </Panel>
    </div>
  );
}
