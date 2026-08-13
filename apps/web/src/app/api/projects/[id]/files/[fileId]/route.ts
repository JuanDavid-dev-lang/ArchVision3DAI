import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { deleteProjectFile } from "@/lib/projects/file-service";

interface RouteContext {
  params: Promise<{ id: string; fileId: string }>;
}

/** DELETE /api/projects/:id/files/:fileId */
export async function DELETE(_request: Request, context: RouteContext) {
  return withErrorHandling("files.delete", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id, fileId } = await context.params;
    const removed = await deleteProjectFile(user.id, id, fileId);
    if (!removed) return apiError("NOT_FOUND", "Archivo no encontrado");

    return apiSuccess({ id: fileId });
  });
}
