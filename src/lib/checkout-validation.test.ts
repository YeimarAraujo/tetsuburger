import { describe, expect, it } from "vitest";
import { fieldForServerError, validateCustomer } from "./checkout-validation";

const form = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});

describe("validateCustomer", () => {
  it("acepta un pedido a domicilio completo", () => {
    expect(
      validateCustomer(
        form({ customer_name: "Ana", customer_phone: "300 123 4567", customer_address: "Calle 10 #5-20" }),
        "DOMICILIO"
      )
    ).toEqual({});
  });

  it("marca cada campo con su propio error", () => {
    const errors = validateCustomer(
      form({ customer_name: " A ", customer_phone: "abc", customer_address: "x" }),
      "DOMICILIO"
    );
    expect(Object.keys(errors).sort()).toEqual(["customer_address", "customer_name", "customer_phone"]);
  });

  it("la dirección no es obligatoria al recoger", () => {
    expect(
      validateCustomer(form({ customer_name: "Ana", customer_phone: "3001234567" }), "RECOGIDA")
    ).toEqual({});
  });

  it("pide el teléfono si viene vacío", () => {
    expect(validateCustomer(form({ customer_name: "Ana" }), "RECOGIDA").customer_phone).toMatch(/Ingresa/);
  });
});

describe("fieldForServerError", () => {
  it("relaciona los mensajes del servidor con su campo", () => {
    expect(fieldForServerError("Teléfono inválido")).toBe("customer_phone");
    expect(fieldForServerError("Estamos cerrados")).toBeNull();
  });
});
