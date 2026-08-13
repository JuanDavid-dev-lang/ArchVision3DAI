import { prisma } from "@archvision/database";
import { registerSchema } from "@archvision/validation";
import { apiError, apiSuccess, apiValidationError, readJsonBody, withErrorHandling } from "@/lib/api/response";
import { clientIp, clientKey, consume } from "@/lib/api/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensurePersonalWorkspace } from "@/lib/projects/service";

/** POST /api/auth/register - alta de usuario e inicio de sesion inmediato. */
export async function POST(request: Request) {
  return withErrorHandling("auth.register", async () => {
    const limit = consume(clientKey(request, "register"), 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Demasiados intentos. Reintenta en ${limit.retryAfterSeconds} segundos.`,
      );
    }

    const body = await readJsonBody(request, 8 * 1024);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return apiError("CONFLICT", "Ya existe una cuenta con ese correo");
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        // Verificacion de correo pendiente: se activara con el servicio de
        // envio en Fase 10. Mientras tanto la cuenta queda operativa.
        emailVerifiedAt: null,
      },
    });

    await ensurePersonalWorkspace({ id: user.id, name: user.name });
    await createSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: clientIp(request),
    });

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: "auth.register",
        targetType: "user",
        targetId: user.id,
        ipAddress: clientIp(request),
      },
    });

    return apiSuccess(
      { id: user.id, email: user.email, name: user.name },
      201,
    );
  });
}
