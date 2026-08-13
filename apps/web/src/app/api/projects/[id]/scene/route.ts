import {
  apiError,
  apiSuccess,
  readJsonBody,
  withErrorHandling,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import {
  SceneConflictError,
  SceneValidationError,
  loadScene,
  saveScene,
} from "@/lib/projects/scene-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/:id/scene */
export async function GET(_request: Request, context: RouteContext) {
  return withErrorHandling("scene.get", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;

    try {
      const result = await loadScene(user.id, id);
      if (!result) return apiError("NOT_FOUND", "Proyecto no encontrado");
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof SceneValidationError) {
        return apiError("INTERNAL", "La escena almacenada es invalida", error.problems);
      }
      throw error;
    }
  });
}

/**
 * PUT /api/projects/:id/scene
 * Guarda el documento completo. `expectedRevision` habilita deteccion de
 * conflictos cuando dos pestanas editan el mismo proyecto.
 */
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandling("scene.save", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    // 12 MB: una escena grande con miles de entidades sigue siendo texto.
    const body = await readJsonBody(request, 12 * 1024 * 1024);

    if (typeof body !== "object" || body === null || !("scene" in body)) {
      return apiError("BAD_REQUEST", "Falta el documento de escena");
    }

    const payload = body as { scene: unknown; expectedRevision?: unknown };
    const expectedRevision =
      typeof payload.expectedRevision === "number"
        ? payload.expectedRevision
        : undefined;

    try {
      const result = await saveScene(user.id, id, {
        scene: payload.scene,
        expectedRevision,
      });
      if (!result) return apiError("NOT_FOUND", "Proyecto no encontrado");
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof SceneConflictError) {
        return apiError("CONFLICT", error.message, {
          currentRevision: error.currentRevision,
        });
      }
      if (error instanceof SceneValidationError) {
        return apiError("BAD_REQUEST", "Escena invalida", error.problems);
      }
      throw error;
    }
  });
}
