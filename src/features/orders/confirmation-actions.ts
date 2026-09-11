"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import { buildWhatsappMessage } from "@/lib/whatsapp";
import { addonLabel } from "@/lib/addons";

export interface OrderConfirmation {
  orderNumber: number;
  total: number;
  whatsappUrl: string;
  error?: string;
}

interface ConfirmationItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  addons: {
    name: string;
    price: number;
    quantity?: number;
    target?: string | null;
    components?: number | null;
  }[];
}

const tokenSchema = z.string().uuid("Enlace inválido");

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lee el resumen de un pedido usando su token (sin exponer la tabla orders al
 * público) y reconstruye el enlace de WhatsApp con los mismos detalles que al
 * registrarlo. Reemplaza el antiguo sessionStorage del checkout.
 */
export async function getOrderConfirmation(token: string): Promise<OrderConfirmation> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return { orderNumber: 0, total: 0, whatsappUrl: "", error: "El enlace del pedido no es válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_order_confirmation", {
    p_token: parsed.data,
  });

  if (error || !data || typeof data !== "object") {
    return { orderNumber: 0, total: 0, whatsappUrl: "", error: "No encontramos el pedido." };
  }

  const order = data as Record<string, unknown>;
  if (!order.order_number) {
    return { orderNumber: 0, total: 0, whatsappUrl: "", error: "No encontramos el pedido." };
  }

  const { data: settingsRows } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "whatsapp_number")
    .maybeSingle();

  const waNumber = String(settingsRows?.value ?? "").replace(/[^0-9]/g, "");
  if (!waNumber) {
    return {
      orderNumber: Number(order.order_number),
      total: toNum(order.total),
      whatsappUrl: "",
      error: "El pedido está registrado, pero falta configurar el número de WhatsApp.",
    };
  }

  const items = Array.isArray(order.items)
    ? (order.items as ConfirmationItem[])
    : [];

  const lines = items.map((line) => {
    const base = `${line.quantity}x ${line.product_name}`;
    const addons = Array.isArray(line.addons) ? line.addons : [];
    if (addons.length === 0) return `${base} (${formatCOP(toNum(line.unit_price) * line.quantity)})`;
    const extras = addons
      .map((a) =>
        addonLabel({
          id: String(a.name),
          name: a.name,
          price: a.price,
          quantity: a.quantity,
          target: a.target as "EACH" | "HAMBURGUESA" | "PERRO" | undefined,
          components: a.components ?? undefined,
        })
      )
      .join(", ");
    return `${base} (${formatCOP(toNum(line.unit_price) * line.quantity)}) · + ${extras}`;
  });

  const message = buildWhatsappMessage({
    orderNumber: Number(order.order_number),
    lines,
    subtotal: toNum(order.subtotal),
    deliveryFee: toNum(order.delivery_fee),
    total: toNum(order.total),
    paymentMethod: order.payment_method === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO",
    name: String(order.customer_name ?? ""),
    phone: String(order.customer_phone ?? ""),
    address: String(order.customer_address ?? ""),
    notes: String(order.notes ?? ""),
  });

  return {
    orderNumber: Number(order.order_number),
    total: toNum(order.total),
    whatsappUrl: `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`,
  };
}