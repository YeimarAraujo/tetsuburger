const TIMEZONE = "America/Bogota";

/** Formatea montos en COP sin decimales: 68000 -> "$68.000" */
export function formatCOP(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

/** Fecha legible en hora de Colombia: "24/08/2026, 8:45 p.m." */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** Solo fecha: "24/08/2026" */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** Solo hora: "8:45 PM" */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** Número de pedido con formato #00001 */
export function formatOrderNumber(n: number): string {
  return `#${String(n).padStart(5, "0")}`;
}
