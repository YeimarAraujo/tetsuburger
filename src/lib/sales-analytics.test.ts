import { describe, expect, it } from "vitest";
import {
  classifyMenu,
  daysInRange,
  eachDay,
  parseSalesReport,
  percentChange,
  previousRange,
  splitExpenses,
  suggestFixedCosts,
} from "./sales-analytics";

describe("períodos", () => {
  it("cuenta los días incluyendo ambos extremos", () => {
    expect(daysInRange("2026-10-01", "2026-10-31")).toBe(31);
    expect(daysInRange("2026-10-05", "2026-10-05")).toBe(1);
  });

  it("calcula el período anterior de la misma duración", () => {
    expect(previousRange("2026-10-01", "2026-10-07")).toEqual({
      from: "2026-09-24",
      to: "2026-09-30",
    });
  });

  it("lista todos los días del rango", () => {
    expect(eachDay("2026-02-27", "2026-03-01")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });

  it("variación porcentual sin base devuelve null", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("parseSalesReport", () => {
  it("convierte numeric en texto y tolera respuestas vacías", () => {
    const r = parseSalesReport({
      totals: { orders: 3, sales: "45000.50" },
      products: [{ key: "a", name: "Burger", units: "2", revenue: "30000", cost: "9000" }],
    });
    expect(r.totals.sales).toBe(45000.5);
    expect(r.totals.cost).toBe(0);
    expect(r.products[0].units).toBe(2);
    expect(parseSalesReport(null).products).toEqual([]);
  });
});

describe("classifyMenu", () => {
  it("clasifica por popularidad y ganancia por unidad", () => {
    const items = classifyMenu([
      { key: "estrella", name: "A", units: 50, revenue: 1_000_000, cost: 300_000 }, // 14.000/u
      { key: "caballo", name: "B", units: 50, revenue: 500_000, cost: 300_000 }, // 4.000/u
      { key: "rompe", name: "C", units: 2, revenue: 60_000, cost: 10_000 }, // 25.000/u
      { key: "perro", name: "D", units: 2, revenue: 10_000, cost: 8_000 }, // 1.000/u
    ]);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.menuClass]));
    expect(byKey).toEqual({
      estrella: "estrella",
      caballo: "caballo",
      rompe: "rompecabezas",
      perro: "perro",
    });
  });

  it("ignora productos sin ventas", () => {
    expect(classifyMenu([{ key: "x", name: "X", units: 0, revenue: 0, cost: 0 }])).toEqual([]);
  });
});

describe("suggestFixedCosts", () => {
  it("promedia por mes y agrupa por tipo de costo fijo", () => {
    const s = suggestFixedCosts(
      [
        { category: "Nómina", amount: 3_000_000 },
        { category: "Servicios", amount: 600_000 },
        { category: "Publicidad", amount: 300_000 },
        { category: "Materia prima", amount: 9_000_000 },
        { category: "Empaques", amount: 500_000, includedInProductCost: true },
        { category: "Entrega", amount: 200_000 },
      ],
      3
    );
    expect(s.nomina).toBe(1_000_000);
    expect(s.servicios).toBe(200_000);
    expect(s.otrosFijos).toBe(100_000);
    expect(s.arriendo).toBe(0);
    expect(s.otrosCategorias).toEqual(["Publicidad"]);
  });
});

describe("splitExpenses", () => {
  it("no resta dos veces los gastos incluidos en el costo del producto", () => {
    expect(
      splitExpenses([
        { amount: 100_000 },
        { amount: "20000", includedInProductCost: true },
        { amount: 5_000, includedInProductCost: false },
      ])
    ).toEqual({ operating: 105_000, includedInCost: 20_000 });
  });
});
