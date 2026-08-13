import { timingSafeEqual } from "node:crypto";
import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { getEnv } from "@/lib/env";
import { runRenewals } from "@/lib/billing/service";

/**
 * POST /api/billing/renewals
 *
 * Cobra las suscripciones cuyo periodo ya vencio. Wompi no tiene ciclos
 * propios: alguien tiene que decidir cuando toca cobrar, y ese alguien es un
 * programador externo (cron del servidor, tarea de la plataforma) que llama a
 * esta ruta una vez al dia.
 *
 * No lleva sesion de usuario porque no la ejecuta un usuario. Se protege con
 * un secreto compartido: sin `BILLING_CRON_SECRET` configurado, la ruta no
 * existe a efectos practicos.
 */

function authorized(request: Request): boolean {
  const secret = getEnv().BILLING_CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  return withErrorHandling("billing.renewals", async () => {
    if (!authorized(request)) {
      return apiError("UNAUTHORIZED", "No autorizado");
    }

    const report = await runRenewals();
    console.info("[billing] renovaciones", report);

    return apiSuccess(report);
  });
}
