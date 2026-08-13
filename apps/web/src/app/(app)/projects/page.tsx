import Link from "next/link";
import type { Metadata } from "next";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surface";
import { ProjectCard } from "@/components/projects/project-card";
import { requirePageUser } from "@/lib/auth/guards";
import { listProjects } from "@/lib/projects/service";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const search = params.search?.trim();

  const { items } = await listProjects(user.id, {
    limit: 50,
    ...(search ? { search } : {}),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length} {items.length === 1 ? "proyecto" : "proyectos"} en tu espacio de trabajo.
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="size-4" aria-hidden />
            Nuevo proyecto
          </Button>
        </Link>
      </div>

      <Panel>
        <PanelHeader
          title="Todos los proyectos"
          description="Ordenados por ultima modificacion"
          action={
            <form action="/projects" className="flex gap-2">
              <input
                type="search"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Buscar por nombre"
                aria-label="Buscar proyectos"
                className="h-8 w-48 rounded-md border border-line bg-surface px-2.5 text-xs text-ink placeholder:text-ink-subtle"
              />
              <Button type="submit" size="sm" variant="secondary">Buscar</Button>
            </form>
          }
        />

        {items.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="size-8" aria-hidden />}
            title={search ? "Sin resultados" : "Aun no tienes proyectos"}
            description={
              search
                ? `Ningun proyecto coincide con "${search}".`
                : "Crea tu primer modelo desde fotografias, un plano o dibujando el croquis."
            }
            action={
              <Link href="/projects/new">
                <Button size="sm">Nuevo proyecto</Button>
              </Link>
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
