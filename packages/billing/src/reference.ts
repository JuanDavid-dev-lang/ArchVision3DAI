import type { BillingInterval, PlanId } from "@archvision/config";

/**
 * Referencia de pago.
 *
 * Es el unico dato que viaja a la pasarela y vuelve en el evento, asi que hace
 * de nexo entre las dos partes. Tres exigencias:
 *
 *  - unica, para no confundir dos cobros distintos;
 *  - legible en el panel de la pasarela, para conciliar sin abrir la base;
 *  - sin datos personales, porque acaba en registros de terceros.
 *
 * De ahi el formato: plan, ciclo, momento y un sufijo aleatorio. Ni correo ni
 * nombre ni identificador de usuario.
 */

const SAFE = /[^a-zA-Z0-9-]/g;

export interface ReferenceParts {
  plan: PlanId;
  interval: BillingInterval;
  kind: "alta" | "renovacion";
}

export function buildReference(
  parts: ReferenceParts,
  now: Date,
  random: string,
): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const suffix = random.replace(SAFE, "").slice(0, 10) || "0";
  const kind = parts.kind === "alta" ? "new" : "ren";
  return `av-${parts.plan}-${parts.interval}-${kind}-${stamp}-${suffix}`;
}

/** Lee una referencia. Devuelve null si no la generamos nosotros. */
export function parseReference(reference: string): ReferenceParts | null {
  const match = /^av-(free|pro|studio|enterprise)-(month|year)-(new|ren)-/.exec(reference);
  if (!match) return null;

  return {
    plan: match[1] as PlanId,
    interval: match[2] as BillingInterval,
    kind: match[3] === "new" ? "alta" : "renovacion",
  };
}
