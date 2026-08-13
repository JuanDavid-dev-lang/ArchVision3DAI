import Link from "next/link";
import type { Metadata } from "next";
import { FolderOpen, HardDrive, Loader2, Plus, Trash2 } from "lucide-react";
import { planLimits } from "@archvision/config";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surface";
import { ProjectCard } from "@/components/projects/project-card";
import { DemoProjectButton } from "@/components/projects/demo-project-button";
import { requirePageUser } from "@/lib/auth/guards";
import { getWorkspaceStats, listProjects } from "@/lib/projects/service";
import { formatBytes } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const user = await requirePageUser();
  const [{ items }, stats] = await Promise.all([
    listProjects(user.id, { limit: 6 }),
    getWorkspaceStats(user.id),
  ]);

  const limits = planLimits(user.plan);
  const storageLabel =
    limits.maxStorageBytes < 0
      ? formatBytes(stats.storageBytes)
      : `${formatBytes(stats.storageBytes)} / ${formatBytes(limits.maxStorageBytes)}`;

  const cards = [
    { label: "Proyectos activos", value: String(stats.projects), icon: FolderOpen },
    { label: "En procesamiento", value: String(stats.processing), icon: Loader2 },
    { label: "Almacenamiento", value: storageLabel, icon: HardDrive },
    { label: "En papelera", value: String(stats.trashed), icon: Trash2 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Hola, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Continua donde lo dejaste o empieza un modelo nuevo.
          </p>
        </div>
        <div className="flex gap-2">
          <DemoProjectButton />
          <Link href="/projects/new">
            <Button>
              <Plus className="size-4" aria-hidden />
              Nuevo proyecto
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Panel key={card.label} className="flex items-center gap-3 p-4">
              <span className="grid size-9 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-ink">{card.value}</p>
                <p className="truncate text-[11px] text-ink-subtle">{card.label}</p>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <PanelHeader
          title="Proyectos recientes"
          description="Ordenados por ultima modificacion"
          action={
            <Link href="/projects">
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          }
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="size-8" aria-hidden />}
            title="Aun no tienes proyectos"
            description="Crea uno desde cero, dibuja un plano o carga la casa demo para explorar la plataforma."
            action={
              <div className="flex gap-2">
                <DemoProjectButton />
                <Link href="/projects/new">
                  <Button size="sm">Nuevo proyecto</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
