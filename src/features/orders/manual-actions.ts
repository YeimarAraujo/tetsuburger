"use server";

import { z } from "zod";
import { checkStaff } from "@/features/auth/guard";
import {
  buildOrderFromItems,
  persistOrder,
} from "@/features/orders/order-builder";

export interface ManualOrderResult {
  error?: string;
  orderNumber?: number;
}

const manualSchema = z
  .object({
    customer_name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
    customer_phone: z.string().trim().max(30).default(""),
    customer_address: z.string().trim().max(200).default(""),
    delivery_type: z.enum(["DOMICILIO", "RECOGIDA", "LOCAL"]),
    delivery_fee: z.coerce.number().min(0).max(999_999),
    delivery_fee_retained: z.boolean().default(false),
    payment_method: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
    notes: z.string().trim().max(300).default(""),
    // Valor final opcional a cobrar (puede subir o bajar el total calculado).
    final_total: z.coerce.number().min(0).max(10_000_000).optional(),
  })
  .refine(
    (data) =>
      data.delivery_type !== "DOMICILIO" || data.customer_address.length >= 5,
    { message: "La dirección es obligatoria para domicilios", path: ["customer_address"] }
  );

/**
 * Pedido MANUAL (llamada, mesa, WhatsApp directo…).
 * Misma estructura de datos que un pedido WEB; nace CONFIRMADO porque
 * ya fue tomado verbalmente por el personal.
 */
export async function createManualOrder(
  payloadRaw: unknown,
  itemsRaw: unknown
): Promise<ManualOrderResult> {
  const check = await checkStaff();
  if (!check.ok) return { error: check.error };

  const parsed = manualSchema.safeParse(payloadRaw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const built = await buildOrderFromItems(itemsRaw);
  if (built.error || !built.lines) return { error: built.error };

  const data = parsed.data;
  const subtotal = built.subtotal ?? 0;

  // RECOGIDA/LOCAL no llevan costo de domicilio
  const deliveryFee =
    data.delivery_type === "DOMICILIO" ? Number(data.delivery_fee) : 0;
  // Si el pedido es exento (sin cargo de domicilio), no puede marcarse como retenido.
  const deliveryFeeRetained =
    data.delivery_fee_retained && deliveryFee > 0;
  const base = subtotal + deliveryFee;
  // Si el personal define un valor final, se guarda como ajuste con signo
  // (total = base − ajuste); si no, el pedido queda con el total calculado.
  const finalAdjustment =
    data.final_total !== undefined ? base - data.final_total : 0;
  const total = base - finalAdjustment;

  const persisted = await persistOrder({
    origin: "MANUAL",
    status: "CONFIRMADO",
    lines: built.lines,
    subtotal,
    deliveryFee,
    deliveryFeeRetained,
    finalAdjustment,
    total,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerAddress:
      data.delivery_type === "DOMICILIO" ? data.customer_address : "",
    notes: data.notes,
    deliveryType: data.delivery_type,
    paymentMethod: data.payment_method,
    createdBy: check.userId ?? null,
    confirmedAt: new Date().toISOString(),
  });

  if (persisted.error) return { error: persisted.error };

  return { orderNumber: persisted.orderNumber };
}
