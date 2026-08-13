"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Acciones de la papelera.
 * El borrado definitivo pide confirmacion explicita porque es irreversible.
 */
export function TrashActions({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"restore" | "purge" | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function restore() {
    setBusy("restore");
    await fetch(`/api/projects/${projectId}/restore`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function purge() {
    setBusy("purge");
    await fetch(`/api/projects/${projectId}?permanent=true`, { method: "DELETE" });
    setBusy(null);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-danger">
          Borrar {projectName} para siempre?
        </span>
        <Button size="sm" variant="danger" onClick={purge} loading={busy === "purge"}>
          Si, borrar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={restore} loading={busy === "restore"}>
        Restaurar
      </Button>
      <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
        Borrar
      </Button>
    </div>
  );
}
