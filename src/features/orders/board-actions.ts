"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStaff } from "@/features/auth/guard";
import { bogotaToday } from "@/lib/bogota";
import { consumeInventoryForOrder } from "@/features/orders/consumption";
import { buildOrderFromItems, orderItemsSchema } from "@/features/orders/order-builder";
import { ORDER_STATUS_META, canTransition } from "@/lib/order-status";
import type { OrderStatus } from "@/types/db";

export interface ActionResult {
  error?: string;
}

/**
 * Verifica que la acción la ejecute un usuario del panel con perfil de staff.
 * La escritura real se hace con service_role porque orders no permite
 * UPDATE ni para staff por diseño (toda mutación pasa por aquí).
 */
async function assertStaff(): Promise<ActionResult | null> {
  const check = await checkStaff();
  if (!check.ok) return { error: check.error };
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

type OrderStatusValue = (typeof statusValues)[number];

function revalidateOrderViews() {
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/caja");
}

/**
 * Cambia el estado de un pedido. Solo se permiten las transiciones del flujo
 * (canTransition) y la validación se repite en la base de datos bajo bloqueo
 * (change_order_status, migración 0032), que además registra quién lo hizo y,
 * al entregar, la venta en caja dentro de la misma transacción.
 */
export async function updateOrderStatus(
  orderId: string,
  toStatus: OrderStatusValue,
  cancellationReason?: string
): Promise<ActionResult> {
  const check = await checkStaff();
  if (!check.ok) return { error: check.error };

  const parsed = z
    .object({
      orderId: z.string().uuid(),
      toStatus: z.enum(statusValues),
      reason: z.string().trim().max(200).default(""),
    })
    .safeParse({ orderId, toStatus, reason: cancellationReason ?? "" });

  if (!parsed.success) return { error: "Datos inválidos" };
  const { toStatus: to, reason } = parsed.data;

  if (to === "CANCELADO" && reason.length < 3) {
    return { error: "Indica el motivo de la cancelación" };
  }

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, delivery_type")
    .eq("id", parsed.data.orderId)
    .single();

  if (!order) return { error: "Pedido no encontrado" };
  if (order.status === to) return {};
  if (!canTransition(order.status, to, order.delivery_type)) {
    return {
      error: `El pedido está en "${ORDER_STATUS_META[order.status as OrderStatus].label}" y no puede pasar a "${ORDER_STATUS_META[to].label}".`,
    };
  }

  // Al pasar a EN_PREPARACION se descuentan los insumos ANTES de cambiar el
  // estado: si falta stock, el pedido sigue en CONFIRMADO sin nada que revertir.
  // El descuento es idempotente (no se repite si ya se aplicó).
  if (to === "EN_PREPARACION") {
    const consumption = await consumeInventoryForOrder(parsed.data.orderId);
    if (consumption.error) return { error: consumption.error };
  }

  const { error: rpcError } = await supabase.rpc("change_order_status", {
    p_order_id: parsed.data.orderId,
    p_to: to,
    p_actor: check.userId ?? null,
    p_reason: reason,
  });

  if (rpcError) {
    // PGRST202: la migración 0032 aún no está aplicada; se usa el camino anterior.
    if (rpcError.code === "PGRST202") {
      return legacyUpdateOrderStatus(parsed.data.orderId, to, reason);
    }
    if (rpcError.code === "P0001") return { error: rpcError.message };
    console.error("change_order_status failed", rpcError);
    return { error: "No se pudo actualizar el pedido" };
  }

  revalidateOrderViews();
  return {};
}

/** Cambio de estado sin la migración 0032 (sin autor ni transacción). */
async function legacyUpdateOrderStatus(
  orderId: string,
  to: OrderStatusValue,
  reason: string
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("orders")
    .update({
      status: to,
      ...(to === "CANCELADO" ? { cancellation_reason: reason } : {}),
    })
    .eq("id", orderId);

  if (error) return { error: "No se pudo actualizar el pedido" };

  // Al entregar, la venta neta de productos entra a la caja (sin domicilios).
  if (to === "ENTREGADO") {
    const { data: delivered } = await supabase
      .from("orders")
      .select("order_number, subtotal, final_adjustment, payment_method")
      .eq("id", orderId)
      .single();

    const netSales = delivered
      ? Number(delivered.subtotal) - Number(delivered.final_adjustment ?? 0)
      : 0;

    if (delivered && netSales > 0) {
      const { data: existingMovement } = await supabase
        .from("caja_movements")
        .select("id")
        .eq("ref_type", "order")
        .eq("ref_id", orderId)
        .maybeSingle();

      if (!existingMovement) {
        const isTransfer = delivered.payment_method === "TRANSFERENCIA";
        await supabase.from("caja_movements").insert({
          movement_date: bogotaToday(),
          tipo: isTransfer ? "VENTA_TRANSFERENCIA" : "VENTA_EFECTIVO",
          metodo: isTransfer ? "TRANSFERENCIA" : "EFECTIVO",
          amount: netSales,
          description: `Venta #${delivered.order_number} ${isTransfer ? "por transferencia" : "en efectivo"}`,
          fuente: `Pedido #${delivered.order_number}`,
          ref_type: "order",
          ref_id: orderId,
        });
      }
    }
  }

  revalidateOrderViews();
  return {};
}

/**
 * Revierte el último cambio de estado de un pedido si ocurrió hace menos de
 * 2 minutos (por ejemplo, un "Entregado" marcado por error). Si se deshace
 * una entrega, también se quita la venta registrada en caja.
 */
export async function undoOrderStatus(
  orderId: string
): Promise<ActionResult & { status?: OrderStatus }> {
  const check = await checkStaff();
  if (!check.ok) return { error: check.error };

  if (!z.string().uuid().safeParse(orderId).success) return { error: "Datos inválidos" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("undo_order_status", {
    p_order_id: orderId,
    p_actor: check.userId ?? null,
  });

  if (error) {
    if (error.code === "PGRST202") {
      return { error: "Para deshacer cambios aplica la migración 0032 en Supabase." };
    }
    if (error.code === "P0001") return { error: error.message };
    console.error("undo_order_status failed", error);
    return { error: "No se pudo deshacer el cambio" };
  }

  revalidateOrderViews();
  return { status: data as OrderStatus };
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
    .select("id, status, subtotal, delivery_fee, final_adjustment")
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

  // Si una línea falla se borran las ya insertadas: el pedido no puede quedar
  // con productos que no suman en los totales.
  const insertedIds: string[] = [];
  const rollback = async () => {
    if (insertedIds.length > 0) {
      await supabase.from("order_items").delete().in("id", insertedIds);
    }
  };

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

    if (itemError || !insertedItem) {
      console.error("addOrderItem: insert order_item failed", itemError);
      await rollback();
      return { error: "No se pudo agregar el producto. Intenta de nuevo." };
    }
    insertedIds.push(insertedItem.id);

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
        console.error("addOrderItem: insert order_item_addons failed", addonsError);
        await rollback();
        return { error: "No se pudo agregar el producto. Intenta de nuevo." };
      }
    }
  }

  const newSubtotal = Number(order.subtotal) + (built.subtotal ?? 0);
  // El ajuste del valor final se conserva: lo acordado sigue restando y los
  // productos nuevos se suman encima.
  const adj = Number(order.final_adjustment ?? 0);
  const newTotal = newSubtotal + Number(order.delivery_fee) - adj;

  const { error: updateError } = await supabase
    .from("orders")
    .update({ subtotal: newSubtotal, total: newTotal })
    .eq("id", order.id);

  if (updateError) {
    await rollback();
    return { error: "No se pudieron actualizar los totales" };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { subtotal: newSubtotal, total: newTotal };
}

/**
 * Marca si el domicilio lo cobra la empresa (retenido) o un repartidor
 * externo. orders no admite UPDATE desde el navegador, así que pasa por aquí.
 */
export async function setDeliveryRetained(
  orderId: string,
  retained: boolean
): Promise<ActionResult> {
  const authError = await assertStaff();
  if (authError) return authError;

  const parsed = z
    .object({ orderId: z.string().uuid(), retained: z.boolean() })
    .safeParse({ orderId, retained });
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ delivery_fee_retained: parsed.data.retained })
    .eq("id", parsed.data.orderId);

  if (error) return { error: "No se pudo actualizar el domicilio" };

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/finanzas");
  return {};
}

const totalsSchema = z.object({
  orderId: z.string().uuid(),
  subtotal: z.number().min(0).max(10_000_000).optional(),
  deliveryFee: z.number().min(0).max(1_000_000).optional(),
  finalValue: z.number().min(0).max(10_000_000).optional(),
});

/**
 * Actualiza los valores de un pedido (subtotal, domicilio y/o valor final) y
 * recalcula el total en un solo lugar:
 *   total = subtotal + domicilio − final_adjustment
 * El "valor final" es la edición manual del total a cobrar (puede subir o
 * bajar); el ajuste se guarda con signo. Al editar subtotal/domicilio sin
 * tocar el valor final, el ajuste se conserva (con tope para no dejar el
 * total en negativo).
 */
export async function updateOrderTotals(
  orderId: string,
  patch: { subtotal?: number; deliveryFee?: number; finalValue?: number }
): Promise<
  ActionResult & {
    subtotal?: number;
    delivery_fee?: number;
    final_adjustment?: number;
    total?: number;
  }
> {
  const authError = await assertStaff();
  if (authError) return authError;

  const parsed = totalsSchema.safeParse({ ...patch, orderId });
  if (!parsed.success) return { error: "Valor inválido" };

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, subtotal, delivery_fee, final_adjustment")
    .eq("id", parsed.data.orderId)
    .single();

  if (!order) return { error: "Pedido no encontrado" };

  const newSubtotal = parsed.data.subtotal ?? Number(order.subtotal);
  const newFee = parsed.data.deliveryFee ?? Number(order.delivery_fee);
  const base = newSubtotal + newFee;

  const adj =
    parsed.data.finalValue !== undefined
      ? base - parsed.data.finalValue
      : Math.min(Number(order.final_adjustment ?? 0), base);

  const newTotal = base - adj;

  const { error } = await supabase
    .from("orders")
    .update({
      subtotal: newSubtotal,
      delivery_fee: newFee,
      final_adjustment: adj,
      total: newTotal,
    })
    .eq("id", order.id);

  if (error) {
    console.error("updateOrderTotals failed", error);
    return { error: "No se pudo actualizar el pedido" };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/caja");
  return {
    subtotal: newSubtotal,
    delivery_fee: newFee,
    final_adjustment: adj,
    total: newTotal,
  };
}
