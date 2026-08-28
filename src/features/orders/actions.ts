"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOpenStatus } from "@/lib/business-hours";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildOrderFromItems,
  persistOrder,
} from "@/features/orders/order-builder";

export interface PlaceOrderResult {
  error?: string;
  orderNumber?: number;
  total?: number;
  whatsappUrl?: string;
}

const customerSchema = z.object({
  customer_name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  customer_phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Teléfono inválido"),
  customer_address: z.string().trim().min(5, "Ingresa una dirección válida").max(200),
  notes: z.string().trim().max(300).default(""),
  payment_method: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
});

function paymentLabel(method: "EFECTIVO" | "TRANSFERENCIA"): string {
  return method === "EFECTIVO" ? "Efectivo" : "Transferencia";
}

function buildWhatsappMessage(params: {
  orderNumber: number;
  lines: string[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA";
  name: string;
  phone: string;
  address: string;
  notes: string;
}): string {
  const {
    orderNumber, lines, subtotal, deliveryFee, total, paymentMethod,
    name, phone, address, notes,
  } = params;

  const parts = [
    `*Pedido ${formatOrderNumber(orderNumber)}* — TETSUBURGER`,
    "",
    ...lines,
    "",
    `Subtotal: ${formatCOP(subtotal)}`,
    ...(deliveryFee > 0 ? [`Domicilio: ${formatCOP(deliveryFee)}`] : []),
    `*Total: ${formatCOP(total)}*`,
    `Medio de pago: ${paymentLabel(paymentMethod)}`,
    "",
    `Nombre: ${name}`,
    `Dirección: ${address}`,
    `Teléfono: ${phone}`,
    ...(notes ? ["", `Nota: ${notes}`] : []),
  ];

  return parts.join("\n");
}

/**
 * Pedido WEB. Reglas de oro:
 * - Los precios SIEMPRE se leen de la BD (nunca del cliente).
 * - Se valida estado del negocio y horario en el servidor.
 * - Escritura con service_role (orders no acepta INSERT anónimo).
 */
export async function placeOrder(
  customerRaw: unknown,
  itemsRaw: unknown
): Promise<PlaceOrderResult> {
  const parsedCustomer = customerSchema.safeParse(customerRaw);
  if (!parsedCustomer.success) {
    return { error: parsedCustomer.error.issues[0].message };
  }

  // Rate limit: 10 pedidos / 10 min por IP
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anonymous";
  const { allowed } = rateLimit(`placeOrder:${ip}`, RATE_LIMITS.placeOrder);
  if (!allowed) {
    return { error: "Has hecho muchos pedidos recientemente. Intenta en unos minutos." };
  }

  const built = await buildOrderFromItems(itemsRaw);
  if (built.error || !built.lines) return { error: built.error };

  const supabase = createAdminClient();

  const [{ data: settingsRows }, { data: hours }] = await Promise.all([
    supabase.from("settings").select("key, value"),
    supabase.from("business_hours").select("*"),
  ]);

  const settings = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  if (settings.store_temporarily_closed === true) {
    return { error: String(settings.closed_message ?? "Estamos cerrados temporalmente.") };
  }

  const allowOutside = settings.allow_orders_outside_hours === true;
  if (!allowOutside && hours) {
    const status = computeOpenStatus(hours, false, undefined);
    if (!status.isOpen) {
      return { error: `${status.message}. El pedido no puede registrarse fuera del horario.` };
    }
  }

  const deliveryFee = Number(settings.delivery_fee ?? 0);
  const minOrderTotal = Number(settings.min_order_total ?? 0);
  const subtotal = built.subtotal ?? 0;

  if (minOrderTotal > 0 && subtotal < minOrderTotal) {
    return { error: `El pedido mínimo es de ${formatCOP(minOrderTotal)}.` };
  }

  const total = subtotal + deliveryFee;
  const customer = parsedCustomer.data;

  const persisted = await persistOrder({
    origin: "WEB",
    status: "PENDIENTE",
    lines: built.lines,
    subtotal,
    deliveryFee,
    deliveryFeeRetained: false,
    total,
    customerName: customer.customer_name,
    customerPhone: customer.customer_phone,
    customerAddress: customer.customer_address,
    notes: customer.notes,
    deliveryType: "DOMICILIO",
    paymentMethod: customer.payment_method,
    createdBy: null,
    confirmedAt: null,
  });

  if (persisted.error || !persisted.orderNumber) {
    return { error: persisted.error ?? "No se pudo registrar el pedido" };
  }

  const waNumber = String(settings.whatsapp_number ?? "").replace(/[^0-9]/g, "");
  if (!waNumber) {
    return {
      orderNumber: persisted.orderNumber,
      total,
      error: "Pedido registrado, pero falta configurar el número de WhatsApp.",
    };
  }

  const lines = built.lines.map((line) => {
    const base = `${line.quantity}x ${line.productName}`;
    if (line.addons.length === 0) return `${base} (${formatCOP(line.unitPrice * line.quantity)})`;
    const extras = line.addons.map((a) => `   + ${a.name}`).join("\n");
    return `${base}\n${extras}`;
  });

  const message = buildWhatsappMessage({
    orderNumber: persisted.orderNumber,
    lines,
    subtotal,
    deliveryFee,
    total,
    paymentMethod: customer.payment_method,
    name: customer.customer_name,
    phone: customer.customer_phone,
    address: customer.customer_address,
    notes: customer.notes,
  });

  const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

  return { orderNumber: persisted.orderNumber, total, whatsappUrl };
}
