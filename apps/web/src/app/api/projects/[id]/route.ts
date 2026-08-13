import { updateProjectSchema } from "@archvision/validation";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  readJsonBody,
  withErrorHandling,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import {
  getProject,
  purgeProject,
  softDeleteProject,
  updateProject,
} from "@/lib/projects/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/:id */
export async function GET(_request: Request, context: RouteContext) {
  return withErrorHandling("projects.get", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const project = await getProject(user.id, id);
    if (!project) return apiError("NOT_FOUND", "Proyecto no encontrado");

    return apiSuccess(project);
  });
}

/** PATCH /api/projects/:id */
export async function PATCH(request: Request, context: RouteContext) {
  return withErrorHandling("projects.update", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const body = await readJsonBody(request, 32 * 1024);
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const project = await updateProject(user.id, id, parsed.data);
    if (!project) return apiError("NOT_FOUND", "Proyecto no encontrado");

    return apiSuccess(project);
  });
}

/**
 * DELETE /api/projects/:id
 * Por defecto envia a la papelera. Con ?permanent=true borra definitivamente
 * el proyecto, su escena, versiones y archivos asociados.
 */
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandling("projects.delete", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const permanent =
      new URL(request.url).searchParams.get("permanent") === "true";

    const ok = permanent
      ? await purgeProject(user.id, id)
      : await softDeleteProject(user.id, id);

    if (!ok) return apiError("NOT_FOUND", "Proyecto no encontrado");
    return apiSuccess({ id, permanent });
  });
}
