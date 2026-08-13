import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@archvision/database";
import { getEnv } from "@/lib/env";

/**
 * Sesiones con token opaco.
 *
 * El token viaja en una cookie httpOnly y en la base de datos solo se guarda
 * su hash SHA-256: una filtracion de la tabla no permite suplantar a nadie.
 * Se prefiere a un JWT porque permite revocacion inmediata (logout global,
 * expulsion de miembros, cambio de contrasena).
 */

export const SESSION_COOKIE = "av_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  avatarUrl: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiryDate(): Date {
  const days = getEnv().SESSION_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Crea la sesion en base de datos y escribe la cookie. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = expiryDate();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 60) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Devuelve el usuario de la sesion vigente o null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {
      // La sesion pudo eliminarse en paralelo; no es un error relevante.
    });
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    plan: session.user.plan,
    avatarUrl: session.user.avatarUrl,
  };
}

/** Cierra la sesion actual y borra la cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {
        // Idempotente: si ya no existe, el objetivo esta cumplido.
      });
  }

  store.delete(SESSION_COOKIE);
}

/** Elimina sesiones caducadas. Invocable desde una tarea programada. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
