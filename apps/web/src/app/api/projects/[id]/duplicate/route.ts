import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { QuotaExceededError, duplicateProject } from "@/lib/projects/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/projects/:id/duplicate */
export async function POST(_request: Request, context: RouteContext) {
  return withErrorHandling("projects.duplicate", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;

    try {
      const copy = await duplicateProject(user.id, id);
      if (!copy) return apiError("NOT_FOUND", "Proyecto no encontrado");
      return apiSuccess(copy, 201);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return apiError("QUOTA_EXCEEDED", error.message);
      }
      throw error;
    }
  });
}
