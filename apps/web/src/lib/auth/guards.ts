import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Guardas de acceso para Server Components.
 *
 * Las rutas de API usan `requireApiUser` (devuelve 401 en vez de redirigir).
 */

export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function redirectIfAuthenticated(target = "/dashboard"): Promise<void> {
  const user = await getSessionUser();
  if (user) redirect(target);
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}
