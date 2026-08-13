import type { BillingInterval } from "@archvision/config";

/**
 * Aritmetica de periodos.
 *
 * Un mes no son 30 dias. Si alguien contrata el 31 de enero, su siguiente
 * cobro es el 28 de febrero, y el de marzo vuelve al 31: lo contrario haria
 * que la fecha de cobro se fuera desplazando sola mes a mes.
 *
 * Todo se calcula en UTC. La hora local del usuario no cambia cuando vence un
 * periodo, y mezclar husos horarios en fechas de cobro produce errores de un
 * dia que solo aparecen para parte de los clientes.
 */

/** Ultimo dia del mes indicado, en UTC. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Suma meses conservando el dia del mes cuando existe.
 *
 * El dia se recorta al ultimo del mes destino, pero el original no se pierde:
 * quien contrata un 31 sigue cobrando el 31 en los meses que lo tienen.
 */
export function addMonths(date: Date, months: number, anchorDay?: number): Date {
  const day = anchorDay ?? date.getUTCDate();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;

  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const clamped = Math.min(day, daysInMonth(targetYear, targetMonth));

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clamped,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function monthsIn(interval: BillingInterval): number {
  return interval === "year" ? 12 : 1;
}

/** Fin del periodo que empieza en `start`. */
export function periodEnd(
  start: Date,
  interval: BillingInterval,
  anchorDay?: number,
): Date {
  return addMonths(start, monthsIn(interval), anchorDay);
}

/**
 * Encadena el periodo siguiente.
 *
 * Parte del fin del anterior y no de "ahora": si un cobro se procesa con dos
 * dias de retraso, el cliente no pierde esos dos dias. Solo cuando el retraso
 * supera un periodo entero se reancla en la fecha del cobro, para no arrastrar
 * una deuda de tiempo que nadie va a pagar.
 */
export function nextPeriod(
  currentEnd: Date,
  interval: BillingInterval,
  now: Date,
  anchorDay?: number,
): { start: Date; end: Date } {
  const candidate = periodEnd(currentEnd, interval, anchorDay);
  if (candidate.getTime() > now.getTime()) {
    return { start: currentEnd, end: candidate };
  }

  // El retraso supera un periodo entero: se reancla en el cobro para no
  // arrastrar tiempo que nadie va a pagar.
  return { start: now, end: periodEnd(now, interval, now.getUTCDate()) };
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

/** Dias que quedan hasta `end`, nunca negativo. */
export function daysLeft(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}
