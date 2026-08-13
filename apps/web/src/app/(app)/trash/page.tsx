import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surface";
import { TrashActions } from "@/components/projects/trash-actions";
import { requirePageUser } from "@/lib/auth/guards";
import { listProjects } from "@/lib/projects/service";
import { formatRelativeDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Papelera" };

export default async function TrashPage() {
  const user = await requirePageUser();
  const { items } = await listProjects(user.id, { includeDeleted: true, limit: 50 });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Papelera</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Los proyectos eliminados se conservan hasta que los borres de forma
          definitiva. El borrado permanente elimina tambien escenas, versiones y
          archivos originales.
        </p>
      </div>

      <Panel>
        <PanelHeader title="Proyectos eliminados" />
        {items.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="size-8" aria-hidden />}
            title="La papelera esta vacia"
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((project) => (
              <li key={project.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{project.name}</p>
                  <p className="text-[11px] text-ink-subtle">
                    Eliminado {formatRelativeDate(project.updatedAt)}
                  </p>
                </div>
                <TrashActions projectId={project.id} projectName={project.name} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
