import { requirePageUser } from "@/lib/auth/guards";

/**
 * Shell del editor: pantalla completa, sin la navegacion del dashboard.
 * Mantiene la misma guarda de sesion que el resto del area privada.
 */
export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageUser();
  return <div className="h-screen overflow-hidden">{children}</div>;
}
