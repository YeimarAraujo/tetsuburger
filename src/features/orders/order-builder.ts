import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CartAddon } from "@/store/cart";

/**
 * Lógica compartida por pedidos WEB y MANUALES:
 * valida los items contra la base de datos y recalcula todo server-side.
 */

export const orderAddonsSchema = z
  .array(
    z.object({
      addon_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(10).default(1),
      target: z.enum(["EACH", "HAMBURGUESA", "PERRO"]).optional(),
      components: z.number().int().min(1).optional(),
    })
  )
  .max(15)
  .default([]);

export const orderItemsSchema = z
  .array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(50),
      addons: orderAddonsSchema,
    })
  )
  .min(1, "El carrito está vacío")
  .max(40);

export interface PreparedLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  addons: CartAddon[];
}

export interface BuildResult {
  error?: string;
  lines?: PreparedLine[];
  subtotal?: number;
}

export async function buildOrderFromItems(itemsRaw: unknown): Promise<BuildResult> {
  const parsed = orderItemsSchema.safeParse(itemsRaw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = createAdminClient();

  const productIds = [...new Set(parsed.data.map((i) => i.product_id))];
  const allAddonIds = [
    ...new Set(parsed.data.flatMap((i) => i.addons.map((a) => a.addon_id))),
  ];

  const [{ data: products }, { data: addons }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, price, is_active, is_available, conteo_hamburguesas, conteo_perros"
      )
      .in("id", productIds),
    allAddonIds.length > 0
      ? supabase
          .from("addons")
          .select("id, name, price, is_active")
          .in("id", allAddonIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; price: number; is_active: boolean }[] | null,
        }),
  ]);

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const addonMap = new Map((addons ?? []).map((a) => [a.id, a]));

  let subtotal = 0;
  const lines: PreparedLine[] = [];

  for (const item of parsed.data) {
    const product = productMap.get(item.product_id);

    if (!product || !product.is_active || !product.is_available) {
      return { error: "Un producto de tu pedido ya no está disponible." };
    }

    const itemAddons: CartAddon[] = [];
    for (const entry of item.addons) {
      const addon = addonMap.get(entry.addon_id);
      if (!addon || !addon.is_active) {
        return { error: "Un adicional ya no está disponible." };
      }

      const hamburguesas = Number(product.conteo_hamburguesas) || 0;
      const perros = Number(product.conteo_perros) || 0;
      const comboCount = hamburguesas + perros;
      const isCombo = comboCount >= 2;

      if (entry.target) {
        if (!isCombo) {
          return {
            error: `"${addon.name}" tiene destinatario específico, pero ${product.name} no es un combo.`,
          };
        }
        if (entry.target === "HAMBURGUESA" && hamburguesas <= 0) {
          return {
            error: `El combo ${product.name} no incluye hamburguesas para añadirle "${addon.name}".`,
          };
        }
        if (entry.target === "PERRO" && perros <= 0) {
          return {
            error: `El combo ${product.name} no incluye perros para añadirle "${addon.name}".`,
          };
        }
      }

      itemAddons.push({
        id: addon.id,
        name: addon.name,
        price: Number(addon.price),
        quantity: entry.quantity,
        target: entry.target,
        components:
          entry.target === "EACH"
            ? Math.max(1, entry.components ?? comboCount)
            : undefined,
      });
    }

    subtotal += Number(product.price) * item.quantity;
    subtotal +=
      itemAddons.reduce(
        (s, a) =>
          s + a.price * (a.quantity ?? 1) * (a.target === "EACH" ? (a.components ?? 1) : 1),
        0
      ) * item.quantity;

    lines.push({
      productId: product.id,
      productName: product.name,
      unitPrice: Number(product.price),
      quantity: item.quantity,
      addons: itemAddons,
    });
  }

  return { lines, subtotal };
}

/** Inserta el pedido + líneas + adicionales con snapshots históricos */
export async function persistOrder(params: {
  origin: "WEB" | "MANUAL";
  status: "PENDIENTE" | "CONFIRMADO";
  lines: PreparedLine[];
  subtotal: number;
  deliveryFee: number;
  deliveryFeeRetained: boolean;
  total: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  deliveryType: "DOMICILIO" | "RECOGIDA" | "LOCAL";
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA";
  createdBy: string | null;
  confirmedAt: string | null;
}): Promise<{
  error?: string;
  orderId?: string;
  orderNumber?: number;
  confirmationToken?: string;
}> {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      origin: params.origin,
      status: params.status,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      customer_address: params.customerAddress,
      delivery_type: params.deliveryType,
      payment_method: params.paymentMethod,
      delivery_fee: params.deliveryFee,
      delivery_fee_retained: params.deliveryFeeRetained,
      subtotal: params.subtotal,
      total: params.total,
      notes: params.notes,
      created_by: params.createdBy,
      ...(params.confirmedAt ? { confirmed_at: params.confirmedAt } : {}),
    })
    .select("id, order_number, confirmation_token")
    .single();

  if (error || !order) {
    return {
      error: `No se pudo registrar el pedido: ${error?.message ?? "error desconocido"}`,
    };
  }

  for (const line of params.lines ?? []) {
    const { data: insertedItem, error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: line.productId,
        product_name: line.productName,
        unit_price: line.unitPrice,
        quantity: line.quantity,
      })
      .select("id")
      .single();

    if (itemError || !insertedItem) {
      await supabase.from("orders").delete().eq("id", order.id);
      return {
        error: `No se pudo registrar el pedido: ${itemError?.message ?? "no se pudo insertar el ítem"}`,
      };
    }

    if (line.addons.length > 0) {
      const { error: addonsError } = await supabase.from("order_item_addons").insert(
        line.addons.map((a) => ({
          order_item_id: insertedItem.id,
          addon_id: a.id,
          addon_name: a.name,
          addon_price: a.price,
          quantity: a.quantity ?? 1,
          target: a.target ?? null,
          components_qty: a.target === "EACH" ? (a.components ?? 1) : null,
        }))
      );

      if (addonsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        return { error: `No se pudo registrar el pedido: ${addonsError.message}` };
      }
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    confirmationToken: order.confirmation_token,
  };
}
