"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Layers, MoreHorizontal, Ruler, Trash2 } from "lucide-react";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ProjectSummary,
} from "@archvision/types";
import { formatArea } from "@archvision/shared";
import { Badge, Panel, ProgressBar, type BadgeTone } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { cn, formatBytes, formatRelativeDate } from "@/lib/utils";

const STATUS_TONE: Record<ProjectSummary["status"], BadgeTone> = {
  draft: "neutral",
  processing: "accent",
  ready: "ok",
  error: "danger",
};

/** Tarjeta de proyecto con acciones rapidas. */
export function ProjectCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"duplicate" | "delete" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  async function duplicate() {
    setBusy("duplicate");
    await fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" });
    setBusy(null);
    setMenuOpen(false);
    router.refresh();
  }

  async function moveToTrash() {
    setBusy("delete");
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    setBusy(null);
    setMenuOpen(false);
    router.refresh();
  }

  return (
    <Panel className="group flex flex-col overflow-hidden">
      <Link
        href={`/projects/${project.id}`}
        className="relative block aspect-[16/10] overflow-hidden border-b border-line bg-surface-2"
      >
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt={`Miniatura de ${project.name}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="blueprint-grid grid size-full place-items-center">
            <span className="font-mono text-[11px] text-ink-subtle">
              sin vista previa
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2">
          <Badge tone={STATUS_TONE[project.status]}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="block truncate text-sm font-semibold text-ink hover:text-accent"
            >
              {project.name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-ink-subtle">
              {PROJECT_TYPE_LABELS[project.type]} · {formatRelativeDate(project.updatedAt)}
            </p>
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Acciones del proyecto"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-line bg-surface shadow-lg"
              >
                <button
                  role="menuitem"
                  onClick={duplicate}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-surface-2 disabled:opacity-50"
                >
                  <Copy className="size-3.5" aria-hidden /> Duplicar
                </button>
                <button
                  role="menuitem"
                  onClick={moveToTrash}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Enviar a papelera
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-[11px] text-ink-subtle">
          <div className="flex items-center gap-1">
            <Layers className="size-3.5" aria-hidden />
            <dd>{project.floorsCount} {project.floorsCount === 1 ? "planta" : "plantas"}</dd>
          </div>
          <div className="flex items-center gap-1">
            <Ruler className="size-3.5" aria-hidden />
            <dd>{project.areaEstimate ? formatArea(project.areaEstimate) : "sin area"}</dd>
          </div>
          <dd className="text-right font-mono">{formatBytes(project.sizeBytes)}</dd>
        </dl>

        {project.status === "processing" ? (
          <ProgressBar value={project.progress} label="Procesando" />
        ) : null}

        <div className={cn("mt-auto flex gap-2 pt-1")}>
          <Link href={`/projects/${project.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full justify-center">
              Abrir
            </Button>
          </Link>
        </div>
      </div>
    </Panel>
  );
}
