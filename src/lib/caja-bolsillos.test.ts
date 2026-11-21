import { describe, expect, it } from "vitest";
import { saldoBolsillo, type BolsilloMovement } from "./caja-bolsillos";

const rows: BolsilloMovement[] = [
  { movement_date: "2026-11-01", bolsillo: "COMPRAS", metodo: "EFECTIVO", amount: 20000 },
  { movement_date: "2026-11-01", bolsillo: "GANANCIA", metodo: "EFECTIVO", amount: 30000 },
  { movement_date: "2026-11-02", bolsillo: "COMPRAS", metodo: "TRANSFERENCIA", amount: -50000 },
  { movement_date: "2026-11-03", bolsillo: "GANANCIA", metodo: "TRANSFERENCIA", amount: 10000 },
];

describe("saldoBolsillo", () => {
  it("suma solo los movimientos de esa base, por medio de pago", () => {
    expect(saldoBolsillo(rows, "COMPRAS")).toEqual({
      efectivo: 20000,
      transferencia: -50000,
      total: -30000,
    });
    expect(saldoBolsillo(rows, "GANANCIA")).toEqual({
      efectivo: 30000,
      transferencia: 10000,
      total: 40000,
    });
  });

  it("respeta la fecha de corte (inclusive)", () => {
    const s = saldoBolsillo(rows, "COMPRAS", "2026-11-01");
    expect(s.efectivo).toBe(20000);
    expect(s.transferencia).toBe(0);
  });

  it("un traslado suma cero entre las dos bases", () => {
    const traslado: BolsilloMovement[] = [
      { movement_date: "2026-11-04", bolsillo: "GANANCIA", metodo: "EFECTIVO", amount: -5000 },
      { movement_date: "2026-11-04", bolsillo: "COMPRAS", metodo: "EFECTIVO", amount: 5000 },
    ];
    expect(
      saldoBolsillo(traslado, "COMPRAS").total + saldoBolsillo(traslado, "GANANCIA").total
    ).toBe(0);
  });
});
