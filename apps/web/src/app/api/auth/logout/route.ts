import { apiSuccess, withErrorHandling } from "@/lib/api/response";
import { destroySession } from "@/lib/auth/session";

/** POST /api/auth/logout - idempotente. */
export async function POST() {
  return withErrorHandling("auth.logout", async () => {
    await destroySession();
    return apiSuccess({ ok: true });
  });
}
