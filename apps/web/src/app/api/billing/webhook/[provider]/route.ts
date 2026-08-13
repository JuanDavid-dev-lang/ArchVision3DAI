import { apiError, apiSuccess, withErrorHandling } from "@/lib/api/response";
import { handleProviderEvent } from "@/lib/billing/service";

/**
 * POST /api/billing/webhook/:provider
 *
 * Entrada de eventos de la pasarela. Es el unico punto de la aplicacion donde
 * un tercero sin sesion puede provocar un cambio de plan, asi que:
 *
 *  - la firma se verifica sobre el cuerpo CRUDO, antes de interpretarlo;
 *  - un evento sin firma valida no se guarda ni se procesa;
 *  - los repetidos se descartan por clave unica, porque las pasarelas
 *    reintentan y un mismo pago no puede ampliar el periodo dos veces.
 *
 * Se responde 200 tambien cuando el evento se descarta por repetido: un error
 * haria que la pasarela siguiera reintentando algo ya resuelto.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  return withErrorHandling("billing.webhook", async () => {
    const { provider } = await context.params;

    // El cuerpo se lee como texto: parsearlo antes cambiaria los bytes sobre
    // los que se calculo la firma.
    const rawBody = await request.text();
    if (rawBody.length > 256 * 1024) {
      return apiError("PAYLOAD_TOO_LARGE", "Evento demasiado grande");
    }

    const result = await handleProviderEvent(provider, rawBody, request.headers);

    if (!result.handled) {
      // Sin detalles: a quien manda una firma invalida no se le explica por que.
      return apiError("BAD_REQUEST", "Evento rechazado");
    }

    return apiSuccess({ received: true, reason: result.reason ?? "procesado" });
  });
}
