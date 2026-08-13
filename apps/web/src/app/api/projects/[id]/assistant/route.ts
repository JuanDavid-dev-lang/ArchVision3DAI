import { assistantRequestSchema } from "@archvision/validation";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  readJsonBody,
  withErrorHandling,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { clientKey, consume } from "@/lib/api/rate-limit";
import { assistantOverview, runAssistant } from "@/lib/assistant/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Limite de peticiones.
 *
 * Un turno puede acabar en una llamada al modelo de lenguaje, que cuesta
 * dinero: el limite protege la factura tanto como el servidor. Es holgado
 * para una conversacion normal y estrecho para un bucle automatico.
 */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

/** GET /api/projects/:id/assistant — estado inicial del panel. */
export async function GET(_request: Request, context: RouteContext) {
  return withErrorHandling("assistant.overview", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id } = await context.params;
    const overview = await assistantOverview(user.id, id);
    if (!overview) return apiError("NOT_FOUND", "Proyecto no encontrado");

    return apiSuccess(overview);
  });
}

/** POST /api/projects/:id/assistant — un turno de conversacion. */
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandling("assistant.turn", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const limit = consume(
      `${clientKey(request, "assistant")}:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!limit.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Demasiadas peticiones seguidas. Vuelve a intentarlo en ${limit.retryAfterSeconds} s.`,
      );
    }

    const { id } = await context.params;
    // 256 KB: el mensaje es corto y el historial va acotado por el esquema.
    const body = await readJsonBody(request, 256 * 1024);

    const parsed = assistantRequestSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const turn = await runAssistant(user.id, id, parsed.data);
    if (!turn) return apiError("NOT_FOUND", "Proyecto no encontrado");

    return apiSuccess(turn);
  });
}
