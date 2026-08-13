import { createVersionSchema } from "@archvision/validation";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  readJsonBody,
  withErrorHandling,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { currentEntitlement } from "@/lib/billing/service";
import { createVersion, listVersions } from "@/lib/projects/scene-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/:id/versions */
export async function GET(_request: Request, context: RouteContext) {
  return withErrorHandling("versions.list", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const versions = await listVersions(user.id, id);
    if (!versions) return apiError("NOT_FOUND", "Proyecto no encontrado");

    return apiSuccess({ items: versions });
  });
}

/** POST /api/projects/:id/versions - crea un snapshot de la escena actual. */
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandling("versions.create", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const body = await readJsonBody(request, 8 * 1024);
    const parsed = createVersionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const plan = (await currentEntitlement(user.id)).plan;
    const version = await createVersion(user.id, id, parsed.data.label, plan);
    if (!version) return apiError("NOT_FOUND", "Proyecto o escena no encontrados");

    return apiSuccess(version, 201);
  });
}
