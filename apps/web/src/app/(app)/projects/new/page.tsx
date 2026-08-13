import type { Metadata } from "next";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { requirePageUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  await requirePageUser();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Nuevo proyecto</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Define la informacion basica y elige como quieres construir el modelo.
        </p>
      </div>
      <NewProjectForm />
    </div>
  );
}
