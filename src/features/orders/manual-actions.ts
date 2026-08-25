"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
    payment_method: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
    notes: z.string().trim().max(300).default(""),
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
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const parsed = manualSchema.safeParse(payloadRaw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const built = await buildOrderFromItems(itemsRaw);
  if (built.error || !built.lines) return { error: built.error };

  const data = parsed.data;
  const subtotal = built.subtotal ?? 0;

  // RECOGIDA/LOCAL no llevan costo de domicilio
  const deliveryFee =
    data.delivery_type === "DOMICILIO" ? Number(data.delivery_fee) : 0;
  const total = subtotal + deliveryFee;

  const persisted = await persistOrder({
    origin: "MANUAL",
    status: "CONFIRMADO",
    lines: built.lines,
    subtotal,
    deliveryFee,
    total,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerAddress:
      data.delivery_type === "DOMICILIO" ? data.customer_address : "",
    notes: data.notes,
    deliveryType: data.delivery_type,
    paymentMethod: data.payment_method,
    createdBy: user.id,
    confirmedAt: new Date().toISOString(),
  });

  if (persisted.error) return { error: persisted.error };

  return { orderNumber: persisted.orderNumber };
}
