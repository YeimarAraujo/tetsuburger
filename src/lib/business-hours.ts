/**
 * Cálculo del estado del negocio según horarios configurados.
 * day_of_week: 0 = Domingo … 6 = Sábado (igual que Date.getDay()).
 * Soporta cruces de medianoche (ej: 18:00 → 02:00).
 */

export interface HourRow {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

export interface OpenStatus {
  isOpen: boolean;
  /** Motivo legible para mostrar en el catálogo */
  message: string;
  /** ISO timestamp de cuándo abre (para countdown). null si no se pudo calcular */
  nextOpensAt: string | null;
}

/** Hora actual en Colombia como "HH:MM" */
export function nowInBogota(date = new Date()): { time: string; dayOfWeek: number; now: Date } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });

  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const time = `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return { time, dayOfWeek: weekdayMap[parts.weekday as string] ?? 0, now: date };
}

/**
 * Genera un ISO string de la próxima vez que abre en horario Bogotá.
 * @param targetDayOfWeek día de la semana objetivo (0-6)
 * @param opensAt hora de apertura "HH:MM"
 * @param date fecha actual
 */
function nextOpensISO(targetDayOfWeek: number, opensAt: string, date: Date): string {
  const [h, m] = opensAt.split(":").map(Number);

  // Fecha actual en Bogotá
  const bogotaParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = Number(bogotaParts.find((p) => p.type === "year")!.value);
  const mo = Number(bogotaParts.find((p) => p.type === "month")!.value);
  const d = Number(bogotaParts.find((p) => p.type === "day")!.value);

  // Día actual en Bogotá (0=Dom…6=Sáb)
  const currentDow = new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00-05:00`).getDay();

  // Cuántos días faltan hasta targetDayOfWeek
  let daysAhead = targetDayOfWeek - currentDow;
  if (daysAhead < 0) daysAhead += 7;

  // Si es el mismo día, verificar si la hora ya pasó
  if (daysAhead === 0) {
    const target = new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`);
    if (target <= date) daysAhead = 7; // si ya pasó, es el próximo ciclo del mismo día
  }

  const target = new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`);
  target.setDate(target.getDate() + daysAhead);

  return target.toISOString();
}

export function isTimeInRange(time: string, opens: string, closes: string): boolean {
  // Sin cruce de medianoche: 17:00 - 23:00
  if (opens < closes) return time >= opens && time <= closes;
  // Con cruce: 18:00 - 02:00
  return time >= opens || time <= closes;
}

/** Convierte "17:00" → "5:00 PM" */
export function formatHour12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}:00 ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Evalúa si el negocio está abierto ahora.
 * @param temporarilyClosed valor de settings.store_temporarily_closed
 */
export function computeOpenStatus(
  hours: HourRow[],
  temporarilyClosed: boolean,
  closedMessage?: string,
  date = new Date()
): OpenStatus {
  if (temporarilyClosed) {
    return {
      isOpen: false,
      message: closedMessage?.trim() || "Estamos cerrados temporalmente. Vuelve pronto.",
      nextOpensAt: null,
    };
  }

  const { time, dayOfWeek, now } = nowInBogota(date);
  const today = hours.find((h) => h.day_of_week === dayOfWeek);

  if (!today || !today.is_active) {
    // Busca el próximo día abierto para informar al cliente
    const next = [...Array(7).keys()]
      .map((offset) => ({
        day: (dayOfWeek + offset) % 7,
        offset,
        row: hours.find((h) => h.day_of_week === (dayOfWeek + offset) % 7),
      }))
      .find((x) => x.offset > 0 && x.row?.is_active);

    const nextDayName = DAY_NAMES[next?.day ?? 0];
    const nextOpens = next?.row ? formatHour12(next.row.opens_at) : "";
    return {
      isOpen: false,
      message: next
        ? `Nuestro horario de atención comienza el ${nextDayName.toLowerCase()} a las ${nextOpens}`
        : "Hoy no tenemos atención. Vuelve pronto.",
      nextOpensAt: next?.row ? nextOpensISO(next.day, next.row.opens_at, now) : null,
    };
  }

  const open = isTimeInRange(time, today.opens_at, today.closes_at);

  if (open) {
    return {
      isOpen: true,
      message: `Atendemos hasta las ${formatHour12(today.closes_at)}`,
      nextOpensAt: null,
    };
  }

  // Fuera de rango hoy
  return {
    isOpen: false,
    message: `Nuestro horario de atención comienza a las ${formatHour12(today.opens_at)}`,
    nextOpensAt: nextOpensISO(dayOfWeek, today.opens_at, now),
  };
}
