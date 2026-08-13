import type { PlanId } from "./limits";

/**
 * Precios de la suscripcion.
 *
 * En pesos colombianos y en centavos enteros: Wompi cobra en centavos, y usar
 * enteros evita el error clasico de sumar decimales en coma flotante. Un peso
 * son 100 centavos aunque en la practica no circulen; el importe siempre se
 * envia en esa unidad.
 *
 * El plan anual equivale a diez mensualidades: dos meses gratis. Es un
 * descuento que se explica en una frase, a diferencia de un porcentaje que
 * obliga a hacer cuentas para saber cuanto se ahorra.
 */

export type BillingInterval = "month" | "year";

export interface PlanPrice {
  readonly interval: BillingInterval;
  /** Importe en centavos de la moneda. */
  readonly amountCents: number;
  /** Meses que cubre un pago. */
  readonly months: number;
}

export interface PlanPricing {
  readonly plan: PlanId;
  readonly currency: "COP";
  /** Ausente en los planes que no se compran por autoservicio. */
  readonly month?: PlanPrice;
  readonly year?: PlanPrice;
  /** Frase corta para la tabla de precios. */
  readonly tagline: string;
  /** Lo que distingue a este plan del anterior. */
  readonly highlights: readonly string[];
  /** true en el plan que se recomienda por defecto. */
  readonly featured?: boolean;
  /** true cuando el alta pasa por hablar con una persona. */
  readonly contactOnly?: boolean;
}

const price = (amount: number, interval: BillingInterval): PlanPrice => ({
  interval,
  amountCents: amount * 100,
  months: interval === "year" ? 12 : 1,
});

export const PRICING: Record<PlanId, PlanPricing> = {
  free: {
    plan: "free",
    currency: "COP",
    month: price(0, "month"),
    tagline: "Para probar la herramienta con un proyecto real.",
    highlights: [
      "3 proyectos activos",
      "500 MB de almacenamiento",
      "Editor 2D y 3D completo",
      "Importacion de planos y deteccion de muros",
      "Asistente y revision del modelo",
    ],
  },
  pro: {
    plan: "pro",
    currency: "COP",
    month: price(79_000, "month"),
    year: price(790_000, "year"),
    featured: true,
    tagline: "Para quien entrega proyectos a clientes.",
    highlights: [
      "50 proyectos y 20 GB",
      "Hasta 3 personas en el espacio de trabajo",
      "50 versiones guardadas por proyecto",
      "100 analisis de IA al mes",
      "Exportacion en todos los formatos",
    ],
  },
  studio: {
    plan: "studio",
    currency: "COP",
    month: price(249_000, "month"),
    year: price(2_490_000, "year"),
    tagline: "Para oficinas con varios proyectos a la vez.",
    highlights: [
      "300 proyectos y 200 GB",
      "Hasta 15 personas",
      "1.000 analisis de IA al mes",
      "Render hasta 4K",
      "200 versiones por proyecto",
    ],
  },
  enterprise: {
    plan: "enterprise",
    currency: "COP",
    contactOnly: true,
    tagline: "Volumen alto, acuerdos a medida y facturacion propia.",
    highlights: [
      "Proyectos, almacenamiento y personas sin limite",
      "Render hasta 8K",
      "Acuerdo de nivel de servicio",
      "Facturacion y soporte dedicados",
    ],
  },
};

/** Planes que se pueden contratar desde la aplicacion, en orden de precio. */
export const PURCHASABLE_PLANS: readonly PlanId[] = ["pro", "studio"];

export function planPricing(plan: PlanId): PlanPricing {
  return PRICING[plan];
}

/** Precio de un plan en un ciclo, o null si ese ciclo no existe. */
export function priceFor(
  plan: PlanId,
  interval: BillingInterval,
): PlanPrice | null {
  const pricing = PRICING[plan];
  return (interval === "year" ? pricing.year : pricing.month) ?? null;
}

/** Cuanto se ahorra al ano frente a pagar mes a mes, en centavos. */
export function yearlySavingCents(plan: PlanId): number {
  const month = PRICING[plan].month;
  const year = PRICING[plan].year;
  if (!month || !year) return 0;
  return Math.max(0, month.amountCents * 12 - year.amountCents);
}

/**
 * Formatea un importe en centavos como moneda colombiana.
 *
 * Sin decimales: en pesos no se usan, y mostrarlos hace pensar en otra moneda.
 */
export function formatMoney(
  amountCents: number,
  currency: string = "COP",
): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}
