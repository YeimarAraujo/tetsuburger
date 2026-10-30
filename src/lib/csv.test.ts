import { describe, expect, it } from "vitest";
import { bogotaDate, csvText } from "./csv";

describe("csvText", () => {
  it("encierra en comillas y duplica las internas", () => {
    expect(csvText('Ana "la flaca"')).toBe('"Ana ""la flaca"""');
  });

  it("neutraliza textos que Excel interpretaría como fórmula", () => {
    expect(csvText("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvText("+57 300")).toBe("\"'+57 300\"");
    expect(csvText("-1")).toBe("\"'-1\"");
    expect(csvText("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
  });

  it("acepta valores vacíos", () => {
    expect(csvText(null)).toBe('""');
    expect(csvText(undefined)).toBe('""');
  });
});

describe("bogotaDate", () => {
  it("usa el día de Colombia, no el UTC", () => {
    // 21:30 en Bogotá = 02:30 UTC del día siguiente
    expect(bogotaDate("2026-10-23T02:30:00+00:00")).toBe("2026-10-22");
    expect(bogotaDate("2026-10-22T15:00:00-05:00")).toBe("2026-10-22");
  });

  it("devuelve vacío con valores inválidos", () => {
    expect(bogotaDate(null)).toBe("");
    expect(bogotaDate("no-es-fecha")).toBe("");
  });
});
