"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botones de la pasarela simulada.
 *
 * Mandan el evento al webhook real. No conceden nada por su cuenta: si la
 * verificacion de firma o la logica de suscripcion fallaran, aqui se veria.
 */
export function SimulationActions({
  reference,
  approveSignature,
  declineSignature,
}: {
  reference: string;
  approveSignature: string;
  declineSignature: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function send(approve: boolean) {
    setBusy(approve ? "approve" : "decline");
    setMessage(null);

    const response = await fetch("/api/billing/webhook/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        approve,
        signature: approve ? approveSignature : declineSignature,
      }),
    });

    setBusy(null);

    if (!response.ok) {
      setMessage("El evento fue rechazado por el servidor.");
      return;
    }

    router.push("/settings/billing");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full justify-center"
        disabled={busy !== null}
        onClick={() => void send(true)}
      >
        {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        Aprobar el pago
      </Button>

      <Button
        variant="outline"
        className="w-full justify-center"
        disabled={busy !== null}
        onClick={() => void send(false)}
      >
        {busy === "decline" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        Rechazar el pago
      </Button>

      {message ? <p className="text-center text-xs text-danger">{message}</p> : null}
    </div>
  );
}
