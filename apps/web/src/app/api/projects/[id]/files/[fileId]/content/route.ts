import { NextResponse } from "next/server";
import { apiError, withErrorHandling } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth-guard";
import { readProjectFile } from "@/lib/projects/file-service";

interface RouteContext {
  params: Promise<{ id: string; fileId: string }>;
}

/**
 * GET /api/projects/:id/files/:fileId/content
 *
 * Sirve los bytes del archivo. No hay carpeta publica: cada descarga vuelve a
 * comprobar la sesion y la pertenencia al proyecto, de modo que conocer un
 * identificador no basta para leer el plano de otro usuario.
 */
export async function GET(_request: Request, context: RouteContext) {
  return withErrorHandling("files.content", async () => {
    const user = await requireApiUser();
    if (!user) return apiError("UNAUTHORIZED", "Sesion no iniciada");

    const { id, fileId } = await context.params;

    const file = await readProjectFile(user.id, id, fileId);
    if (!file) return apiError("NOT_FOUND", "Archivo no encontrado");

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.data.byteLength),
        // Privado: el contenido depende de la sesion y no debe quedar en
        // caches compartidas.
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
