import type { PaymentMethod } from "@/types/db";

type Money = number | string | null | undefined;

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MIXTO: "Mixto",
};

/** Etiqueta legible del medio de pago; tolera valores nulos o desconocidos. */
export function paymentLabel(method: string | null | undefined): string {
  return PAYMENT_METHOD_LABEL[(method ?? "EFECTIVO") as PaymentMethod] ?? "Efectivo";
}

const toNum = (v: Money) => Number(v ?? 0) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PaymentSplit {
  efectivo: number;
  transferencia: number;
}

/**
 * Reparte la venta NETA de productos (subtotal − ajuste del valor final, sin
 * domicilio) entre efectivo y transferencia. Es la misma regla que aplica la
 * base de datos al registrar la caja (order_payment_split, migración 0036):
 * en un pago mixto la transferencia va primero (hasta la venta neta) y el
 * efectivo es el resto, porque el efectivo absorbe el domicilio.
 */
export function splitOrderPayment(order: {
  payment_method?: string | null;
  subtotal: Money;
  final_adjustment?: Money;
  transfer_amount?: Money;
}): PaymentSplit {
  const net = Math.max(toNum(order.subtotal) - toNum(order.final_adjustment), 0);

  if (order.payment_method === "TRANSFERENCIA") {
    return { efectivo: 0, transferencia: net };
  }
  if (order.payment_method === "MIXTO") {
    const transferencia = Math.min(Math.max(toNum(order.transfer_amount), 0), net);
    return { efectivo: round2(net - transferencia), transferencia };
  }
  return { efectivo: net, transferencia: 0 };
}

export type MixedAmountsResult =
  | { ok: true; cash: number; transfer: number }
  | { ok: false; error: string };

export const MIXED_PAYMENT_ERROR =
  "En un pago mixto el efectivo debe ser mayor que 0 y menor que el total del pedido.";

/**
 * Dado el total a cobrar y el efectivo que paga el cliente, deriva la parte
 * por transferencia. El cliente nunca envía ambos montos: el servidor calcula
 * el segundo para que el desglose siempre sume el total.
 */
export function deriveMixedAmounts(total: Money, cash: Money): MixedAmountsResult {
  const t = round2(toNum(total));
  const c = round2(toNum(cash));
  if (!Number.isFinite(c) || c <= 0 || c >= t) {
    return { ok: false, error: MIXED_PAYMENT_ERROR };
  }
  return { ok: true, cash: c, transfer: round2(t - c) };
}
