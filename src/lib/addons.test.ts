import { describe, expect, it } from "vitest";
import { addonCharged, addonLabel, addonQty } from "./addons";

describe("addonQty", () => {
  it("usa 1 por defecto", () => {
    expect(addonQty({ id: "a", name: "Queso", price: 2000 })).toBe(1);
    expect(addonQty({ id: "a", name: "Queso", price: 2000, quantity: 3 })).toBe(3);
  });
});

describe("addonCharged", () => {
  it("multiplica precio por cantidad", () => {
    expect(
      addonCharged({ id: "a", name: "Queso", price: 2000, quantity: 2 }),
    ).toBe(4000);
  });

  it("aplica el componente extra cuando es EACH", () => {
    expect(
      addonCharged({
        id: "a",
        name: "Queso",
        price: 2000,
        quantity: 2,
        target: "EACH",
        components: 3,
      }),
    ).toBe(12000);
  });
});

describe("addonLabel", () => {
  it("describe destino y cantidad", () => {
    expect(addonLabel({ id: "a", name: "Queso", price: 0, target: "HAMBURGUESA" })).toBe(
      "Queso (a la hamburguesa)",
    );
    expect(
      addonLabel({ id: "a", name: "Queso", price: 0, quantity: 2, target: "PERRO" }),
    ).toBe("2× Queso (al perro)");
    expect(addonLabel({ id: "a", name: "Queso", price: 0 })).toBe("Queso");
  });
});
