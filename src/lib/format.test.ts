import { describe, expect, it } from "vitest";
import {
  formatCOP,
  formatOrderNumber,
  formatDate,
  toFiniteNumber,
} from "./format";

describe("formatCOP", () => {
  it("formatea pesos sin decimales", () => {
    expect(formatCOP(68000).replace(/\s/g, "")).toBe("$68.000");
  });

  it("acepta strings numéricos", () => {
    expect(formatCOP("12500").replace(/\s/g, "")).toBe("$12.500");
  });

  it("cae a cero con valores inválidos", () => {
    expect(formatCOP(Number.NaN).replace(/\s/g, "")).toBe("$0");
  });
});

describe("formatOrderNumber", () => {
  it("rellena a cinco dígitos", () => {
    expect(formatOrderNumber(7)).toBe("#00007");
    expect(formatOrderNumber(12345)).toBe("#12345");
  });
});

describe("formatDate", () => {
  it("usa la zona horaria de Colombia", () => {
    expect(formatDate("2026-10-22T15:00:00-05:00")).toBe("22/10/26");
    expect(formatDate("2026-10-23T06:00:00.000Z")).toBe("23/10/26");
  });
});

describe("toFiniteNumber", () => {
  it("normaliza valores", () => {
    expect(toFiniteNumber("12.5")).toBe(12.5);
    expect(toFiniteNumber(null)).toBe(0);
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
