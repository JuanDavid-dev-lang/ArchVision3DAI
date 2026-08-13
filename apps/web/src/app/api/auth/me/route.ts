import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";

/** GET /api/auth/me - usuario de la sesion actual. */
export async function GET() {
  return withErrorHandling("auth.me", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");
    return apiSuccess(user);
  });
}
