import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { restoreProject } from "@/lib/projects/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/projects/:id/restore - saca el proyecto de la papelera. */
export async function POST(_request: Request, context: RouteContext) {
  return withErrorHandling("projects.restore", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const ok = await restoreProject(user.id, id);
    if (!ok) return apiError("NOT_FOUND", "Proyecto no encontrado");

    return apiSuccess({ id });
  });
}
