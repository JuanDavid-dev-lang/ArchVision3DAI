import "server-only";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Guarda de autenticacion para rutas de API.
 * Devuelve el usuario o `null`; el handler responde 401 con `apiError`.
 */
export async function requireApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}
