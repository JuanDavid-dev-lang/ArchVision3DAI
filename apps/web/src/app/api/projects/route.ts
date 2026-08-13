import { createProjectSchema, projectListQuerySchema } from "@archvision/validation";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  readJsonBody,
  withErrorHandling,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { currentEntitlement } from "@/lib/billing/service";
import { clientKey, consume } from "@/lib/api/rate-limit";
import {
  QuotaExceededError,
  createProject,
  listProjects,
} from "@/lib/projects/service";

/** GET /api/projects - listado paginado del usuario autenticado. */
export async function GET(request: Request) {
  return withErrorHandling("projects.list", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const url = new URL(request.url);
    const parsed = projectListQuerySchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      includeDeleted: url.searchParams.get("includeDeleted") ?? undefined,
    });
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await listProjects(user.id, parsed.data);
    return apiSuccess(result);
  });
}

/** POST /api/projects - crea un proyecto con su escena inicial. */
export async function POST(request: Request) {
  return withErrorHandling("projects.create", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const limit = consume(clientKey(request, "project-create"), 30, 60 * 1000);
    if (!limit.allowed) {
      return apiError("RATE_LIMITED", "Demasiadas creaciones seguidas");
    }

    const body = await readJsonBody(request, 32 * 1024);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    // `demo` no forma parte del esquema publico: solo lo usa el boton
    // "Cargar casa demo" del dashboard.
    const demo =
      typeof body === "object" && body !== null && "demo" in body
        ? Boolean((body as { demo?: unknown }).demo)
        : false;

    try {
      const project = await createProject(
        { userId: user.id, userName: user.name, plan: (await currentEntitlement(user.id)).plan },
        { ...parsed.data, demo },
      );
      return apiSuccess(project, 201);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return apiError("QUOTA_EXCEEDED", error.message);
      }
      throw error;
    }
  });
}
