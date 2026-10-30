import { describe, expect, it } from "vitest";
import {
  computeOpenStatus,
  formatHour12,
  isTimeInRange,
  nowInBogota,
  type HourRow,
} from "./business-hours";

const hours: HourRow[] = [
  { day_of_week: 0, opens_at: "12:00", closes_at: "22:00", is_active: false },
  { day_of_week: 1, opens_at: "11:00", closes_at: "23:00", is_active: true },
  { day_of_week: 2, opens_at: "11:00", closes_at: "23:00", is_active: true },
  { day_of_week: 3, opens_at: "11:00", closes_at: "23:00", is_active: true },
  { day_of_week: 4, opens_at: "11:00", closes_at: "23:00", is_active: true },
  { day_of_week: 5, opens_at: "11:00", closes_at: "23:30", is_active: true },
  { day_of_week: 6, opens_at: "11:00", closes_at: "23:30", is_active: true },
];

// Jueves 22 de octubre de 2026, 15:00 en Bogotá.
const thursdayAfternoon = new Date("2026-10-22T20:00:00.000Z");

describe("nowInBogota", () => {
  it("devuelve hora y día de Colombia", () => {
    const { time, dayOfWeek } = nowInBogota(thursdayAfternoon);
    expect(time).toBe("15:00");
    expect(dayOfWeek).toBe(4);
  });
});

describe("isTimeInRange", () => {
  it("maneja rangos normales", () => {
    expect(isTimeInRange("12:00", "11:00", "23:00")).toBe(true);
    expect(isTimeInRange("10:59", "11:00", "23:00")).toBe(false);
    expect(isTimeInRange("23:00", "11:00", "23:00")).toBe(true);
  });

  it("maneja cruces de medianoche", () => {
    expect(isTimeInRange("23:30", "18:00", "02:00")).toBe(true);
    expect(isTimeInRange("01:59", "18:00", "02:00")).toBe(true);
    expect(isTimeInRange("12:00", "18:00", "02:00")).toBe(false);
  });
});

describe("formatHour12", () => {
  it("convierte a formato de 12 horas", () => {
    expect(formatHour12("17:00")).toBe("5:00 PM");
    expect(formatHour12("09:30")).toBe("9:30 AM");
    expect(formatHour12("00:00")).toBe("12:00 AM");
    expect(formatHour12("12:00")).toBe("12:00 PM");
  });
});

describe("computeOpenStatus", () => {
  it("abre dentro del horario", () => {
    const status = computeOpenStatus(hours, false, undefined, thursdayAfternoon);
    expect(status.isOpen).toBe(true);
    expect(status.message).toContain("11:00 PM");
  });

  it("cierra fuera del horario e informa la apertura", () => {
    const early = new Date("2026-10-22T14:00:00.000Z"); // 9:00 en Bogotá
    const status = computeOpenStatus(hours, false, undefined, early);
    expect(status.isOpen).toBe(false);
    expect(status.message).toContain("11:00 AM");
    expect(status.nextOpensAt).not.toBeNull();
  });

  it("después del cierre informa la apertura del día siguiente, no la de la semana próxima", () => {
    const late = new Date("2026-10-23T04:30:00.000Z"); // jueves 23:30 en Bogotá
    const status = computeOpenStatus(hours, false, undefined, late);
    expect(status.isOpen).toBe(false);
    expect(status.message).toContain("viernes");
    expect(status.nextOpensAt).toBe("2026-10-23T16:00:00.000Z"); // viernes 11:00 en Bogotá
  });

  it("respeta el cierre temporal y su mensaje", () => {
    const status = computeOpenStatus(
      hours,
      true,
      "Cerrado por mantenimiento",
      thursdayAfternoon,
    );
    expect(status.isOpen).toBe(false);
    expect(status.message).toBe("Cerrado por mantenimiento");
    expect(status.nextOpensAt).toBeNull();
  });

  it("informa el próximo día activo cuando hoy no hay atención", () => {
    const sunday = new Date("2026-10-25T17:00:00.000Z"); // domingo 12:00 Bogotá
    const status = computeOpenStatus(hours, false, undefined, sunday);
    expect(status.isOpen).toBe(false);
    expect(status.message).toContain("lunes");
  });
});
