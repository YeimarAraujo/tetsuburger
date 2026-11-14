import { describe, expect, it } from "vitest";
import { deriveMixedAmounts, paymentLabel, splitOrderPayment } from "./payments";

describe("paymentLabel", () => {
  it("traduce cada medio y tolera valores vacíos", () => {
    expect(paymentLabel("EFECTIVO")).toBe("Efectivo");
    expect(paymentLabel("TRANSFERENCIA")).toBe("Transferencia");
    expect(paymentLabel("MIXTO")).toBe("Mixto");
    expect(paymentLabel(null)).toBe("Efectivo");
    expect(paymentLabel("OTRO")).toBe("Efectivo");
  });
});

describe("splitOrderPayment", () => {
  it("efectivo y transferencia van completos a su canal", () => {
    expect(splitOrderPayment({ payment_method: "EFECTIVO", subtotal: 40000 })).toEqual({
      efectivo: 40000,
      transferencia: 0,
    });
    expect(splitOrderPayment({ payment_method: "TRANSFERENCIA", subtotal: 40000 })).toEqual({
      efectivo: 0,
      transferencia: 40000,
    });
  });

  it("descuenta el ajuste del valor final (neto de productos)", () => {
    expect(
      splitOrderPayment({ payment_method: "EFECTIVO", subtotal: 40000, final_adjustment: 5000 })
    ).toEqual({ efectivo: 35000, transferencia: 0 });
  });

  it("mixto: la transferencia va primero y el efectivo es el resto", () => {
    // total 50.000 = 40.000 de productos + 10.000 de domicilio; transfiere 30.000
    expect(
      splitOrderPayment({
        payment_method: "MIXTO",
        subtotal: 40000,
        final_adjustment: 0,
        transfer_amount: 30000,
      })
    ).toEqual({ efectivo: 10000, transferencia: 30000 });
  });

  it("mixto: la transferencia se limita a la venta neta (el efectivo cubre el domicilio)", () => {
    expect(
      splitOrderPayment({ payment_method: "MIXTO", subtotal: 40000, transfer_amount: 45000 })
    ).toEqual({ efectivo: 0, transferencia: 40000 });
  });

  it("acepta montos como texto y nunca devuelve negativos", () => {
    expect(
      splitOrderPayment({
        payment_method: "MIXTO",
        subtotal: "40000.00",
        final_adjustment: "0.00",
        transfer_amount: "15000.50",
      })
    ).toEqual({ efectivo: 24999.5, transferencia: 15000.5 });
    expect(
      splitOrderPayment({ payment_method: "EFECTIVO", subtotal: 1000, final_adjustment: 5000 })
    ).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it("la suma del reparto siempre es la venta neta", () => {
    const s = splitOrderPayment({
      payment_method: "MIXTO",
      subtotal: 33333,
      final_adjustment: 333,
      transfer_amount: 12345,
    });
    expect(s.efectivo + s.transferencia).toBe(33000);
  });
});

describe("deriveMixedAmounts", () => {
  it("deriva la transferencia a partir del efectivo", () => {
    expect(deriveMixedAmounts(50000, 20000)).toEqual({ ok: true, cash: 20000, transfer: 30000 });
  });

  it("rechaza efectivo 0, negativo o igual/mayor al total", () => {
    expect(deriveMixedAmounts(50000, 0).ok).toBe(false);
    expect(deriveMixedAmounts(50000, -1).ok).toBe(false);
    expect(deriveMixedAmounts(50000, 50000).ok).toBe(false);
    expect(deriveMixedAmounts(50000, 60000).ok).toBe(false);
    expect(deriveMixedAmounts(50000, "abc").ok).toBe(false);
  });
});
