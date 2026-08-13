import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/editor-shell";
import { requirePageUser } from "@/lib/auth/guards";
import { getProject } from "@/lib/projects/service";
import { loadScene } from "@/lib/projects/scene-service";

export const metadata: Metadata = { title: "Editor" };

/**
 * Ruta del editor.
 *
 * El servidor resuelve permisos y entrega la escena ya validada; al cliente
 * solo viajan datos serializables, nunca objetos de Three.js.
 */
export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const project = await getProject(user.id, id);
  if (!project) notFound();

  const result = await loadScene(user.id, id);
  if (!result) notFound();

  return (
    <EditorShell
      project={{ id: project.id, name: project.name, units: project.units }}
      scene={result.scene}
      revision={result.revision}
    />
  );
}
