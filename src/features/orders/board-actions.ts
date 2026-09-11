"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bogotaToday } from "@/lib/bogota";
import { consumeInventoryForOrder, validateStockForOrder } from "@/features/orders/consumption";
import { buildOrderFromItems, orderItemsSchema } from "@/features/orders/order-builder";

export interface ActionResult {
  error?: string;
}

/**
 * Verifica que la acción la ejecute un usuario autenticado del panel.
 * La escritura real se hace con service_role porque orders no permite
 * UPDATE ni para staff por diseño (toda mutación pasa por aquí).
 */
async function assertStaff(): Promise<ActionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión expirada. Vuelve a iniciar sesión." };
  return null;
}

/** Guarda la preferencia de sonido del board para el usuario autenticado (profiles.board_muted). */
export async function setBoardMuted(muted: boolean): Promise<ActionResult> {
  const denied = await assertStaff();
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada" };

  const { error } = await supabase
    .from("profiles")
    .update({ board_muted: muted })
    .eq("id", user.id);

  if (error) return { error: "No se pudo guardar la preferencia" };
  return {};
}

const statusValues = [
  "PENDIENTE",
  "CONFIRMADO",
  "EN_PREPARACION",
  "LISTO",
  "EN_CAMINO",
  "ENTREGADO",
  "CANCELADO",
] as const;

export async function updateOrderStatus(
  orderId: string,
  toStatus: (typeof statusValues)[number],
  cancellationReason?: string
): Promise<ActionResult> {
  const authError = await assertStaff();
  if (authError) return authError;

  const parsed = z
    .object({
      orderId: z.string().uuid(),
      toStatus: z.enum(statusValues),
      reason: z.string().trim().max(200).default(""),
    })
    .safeParse({ orderId, toStatus, reason: cancellationReason ?? "" });

  if (!parsed.success) return { error: "Datos inválidos" };

  if (parsed.data.toStatus === "CANCELADO" && parsed.data.reason.length < 3) {
    return { error: "Indica el motivo de la cancelación" };
  }

  const supabase = createAdminClient();

  // Al pasar a EN_PREPARACION: validar stock y descontar de inmediato.
  // El insumo se usa físicamente al preparar, así que la validación/descuento
  // ocurre aquí (temprano), NO al entregar.
  if (parsed.data.toStatus === "EN_PREPARACION") {
    // 1. Validar stock sin descontar aún. Si falta, se bloquea la preparación.
    const validation = await validateStockForOrder(parsed.data.orderId);
    if (validation.error) {
      return { error: validation.error };
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: parsed.data.toStatus,
      ...(parsed.data.toStatus === "CANCELADO"
        ? { cancellation_reason: parsed.data.reason }
        : {}),
    })
    .eq("id", parsed.data.orderId);

  if (error) return { error: "No se pudo actualizar el pedido" };

  // 2. Si pasa a EN_PREPARACION, aplicar el descuento de inventario.
  if (parsed.data.toStatus === "EN_PREPARACION") {
    const consumption = await consumeInventoryForOrder(parsed.data.orderId);
    if (consumption.error) {
      // Revertir si algo falla tras marcar como en preparación (consistencia).
      await supabase
        .from("orders")
        .update({ status: "CONFIRMADO" })
        .eq("id", parsed.data.orderId);
      return { error: consumption.error };
    }
  }

  // 3. Al entregar un pedido, la plata entra a la caja: en efectivo o por
  //    transferencia según el medio de pago del pedido. Se cuenta solo el valor
  //    de los productos (subtotal), igual que en las ventas de Finanzas; los
  //    domicilios no pasan por la caja.
  if (parsed.data.toStatus === "ENTREGADO") {
    const { data: delivered } = await supabase
      .from("orders")
      .select("order_number, subtotal, payment_method")
      .eq("id", parsed.data.orderId)
      .single();

    if (delivered && Number(delivered.subtotal) > 0) {
      // Guard anti doble conteo: si el pedido ya tiene su movimiento de venta
      // (p. ej. se reentregó), no insertar otro.
      const { data: existingMovement } = await supabase
        .from("caja_movements")
        .select("id")
        .eq("ref_type", "order")
        .eq("ref_id", parsed.data.orderId)
        .maybeSingle();

      if (!existingMovement) {
        const isTransfer = delivered.payment_method === "TRANSFERENCIA";
        await supabase.from("caja_movements").insert({
          movement_date: bogotaToday(),
          tipo: isTransfer ? "VENTA_TRANSFERENCIA" : "VENTA_EFECTIVO",
          metodo: isTransfer ? "TRANSFERENCIA" : "EFECTIVO",
          amount: Number(delivered.subtotal),
          description: `Venta #${delivered.order_number} ${isTransfer ? "por transferencia" : "en efectivo"}`,
          fuente: `Pedido #${delivered.order_number}`,
          ref_type: "order",
          ref_id: parsed.data.orderId,
        });
      }
    }
  }

  // El trigger registra historial y timestamps automáticamente.
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/caja");
  return {};
}

/**
 * Agrega productos ENTEROS a un pedido existente (por ej. el cliente pide un
 * perro después de la hamburguesa). Solo permitido antes de la preparación
 * (PENDIENTE o CONFIRMADO): una vez el pedido está en EN_PREPARACION o posterior
 * no se puede modificar. El inventario se descuenta automáticamente cuando el
 * pedido pase a preparación (el nuevo item entra en el cálculo del consumo).
 */
export async function addOrderItem(
  orderId: string,
  itemsRaw: unknown
): Promise<ActionResult & { subtotal?: number; total?: number }> {
  const authError = await assertStaff();
  if (authError) return authError;

  const parsed = z
    .object({
      orderId: z.string().uuid(),
      items: orderItemsSchema,
    })
    .safeParse({ orderId, items: itemsRaw });

  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, subtotal, delivery_fee")
    .eq("id", parsed.data.orderId)
    .single();

  if (!order) return { error: "Pedido no encontrado" };
  if (order.status !== "PENDIENTE" && order.status !== "CONFIRMADO") {
    return {
      error: "El pedido ya está en preparación o posterior; ya no se pueden agregar productos.",
    };
  }

  const built = await buildOrderFromItems(parsed.data.items);
  if (built.error || !built.lines) return { error: built.error ?? "No se pudo validar el producto" };

  for (const line of built.lines) {
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

    if (itemError || !insertedItem) continue;

    if (line.addons.length > 0) {
      await supabase.from("order_item_addons").insert(
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
    }
  }

  const newSubtotal = Number(order.subtotal) + (built.subtotal ?? 0);
  const newTotal = newSubtotal + Number(order.delivery_fee);

  const { error: updateError } = await supabase
    .from("orders")
    .update({ subtotal: newSubtotal, total: newTotal })
    .eq("id", order.id);

  if (updateError) return { error: "No se pudieron actualizar los totales" };

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { subtotal: newSubtotal, total: newTotal };
}
