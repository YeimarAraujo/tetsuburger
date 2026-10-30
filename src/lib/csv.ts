/**
 * Celda de texto para CSV (separador `;`): entre comillas y con las comillas
 * internas duplicadas. Si el texto empieza como fórmula (= + - @, tab o
 * retorno) se antepone `'` para que Excel/Sheets no lo ejecuten: los nombres
 * de cliente los escribe el público en el checkout.
 */
export function csvText(value: string | null | undefined): string {
  const raw = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Fecha "YYYY-MM-DD" en Colombia de un timestamp ISO (no la fecha UTC). */
export function bogotaDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
