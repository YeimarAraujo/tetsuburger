import { describe, expect, it } from "vitest";
import {
  TARGET_FOOD_COST,
  bucketState,
  foodCostPct,
  fullCostPrice,
  grossProfit,
  suggestedPrice,
} from "./pricing";

describe("suggestedPrice", () => {
  it("redondea a los 100 pesos con meta de food cost", () => {
    expect(TARGET_FOOD_COST).toBe(0.3);
    expect(suggestedPrice(3000)).toBe(10000);
    expect(suggestedPrice(3100)).toBe(10400);
  });

  it("devuelve 0 sin costo", () => {
    expect(suggestedPrice(0)).toBe(0);
    expect(suggestedPrice(-5)).toBe(0);
  });
});

describe("foodCostPct / grossProfit", () => {
  it("calcula porcentaje y utilidad", () => {
    expect(foodCostPct(10000, 3000)).toBeCloseTo(30);
    expect(foodCostPct(0, 3000)).toBe(0);
    expect(grossProfit(10000, 3000)).toBe(7000);
    expect(grossProfit(10000, 12000)).toBe(0);
  });
});

describe("fullCostPrice", () => {
  const costs = {
    nomina: 0,
    arriendo: 0,
    servicios: 0,
    otrosFijos: 0,
    unidadesMes: 1000,
    utilidadObjetivo: 0.15,
    comisionPct: 0.05,
    comisionFija: 0,
  };

  it("cubre costos y utilidad", () => {
    const { precio, denom } = fullCostPrice({ ingredientes: 3000, empaque: 500 }, costs);
    expect(denom).toBeCloseTo(0.8);
    expect(precio).toBe(4400);
    expect(precio).toBeGreaterThan(3500);
  });

  it("se protege con márgenes imposibles", () => {
    const result = fullCostPrice(
      { ingredientes: 3000, empaque: 500 },
      { ...costs, utilidadObjetivo: 0.9, comisionPct: 0.2 },
    );
    expect(result.precio).toBe(0);
  });
});

describe("bucketState", () => {
  it("clasifica bajo, ok y alto", () => {
    expect(bucketState(10, 20, 30)).toBe("bajo");
    expect(bucketState(25, 20, 30)).toBe("ok");
    expect(bucketState(35, 20, 30)).toBe("alto");
  });
});
