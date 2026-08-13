"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary global.
 * Registra el fallo en consola (sustituible por un servicio de logging) y
 * ofrece reintentar sin recargar toda la aplicacion.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md rounded-panel border border-line bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Algo salio mal</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Se produjo un error inesperado. Puedes reintentar la accion; si
          persiste, vuelve al dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-ink-subtle">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Reintentar</Button>
          <a href="/dashboard">
            <Button variant="outline">Ir al dashboard</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
