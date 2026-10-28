"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStaff } from "@/features/auth/guard";
import { bogotaToday } from "@/lib/bogota";
import { consumeInventoryForOrder, validateStockForOrder } from "@/features/orders/consumption";
import { buildOrderFromItems, orderItemsSchema } from "@/features/orders/order-builder";

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
  //    transferencia según el medio de pago del pedido. Se cuenta el valor
  //    neto de los productos (subtotal menos el ajuste del valor final), igual
  //    que en las ventas de Finanzas; los domicilios no pasan por la caja.
  if (parsed.data.toStatus === "ENTREGADO") {
    const { data: delivered } = await supabase
      .from("orders")
      .select("order_number, subtotal, final_adjustment, payment_method")
      .eq("id", parsed.data.orderId)
      .single();

    const netSales = delivered
      ? Number(delivered.subtotal) - Number(delivered.final_adjustment ?? 0)
      : 0;

    if (delivered && netSales > 0) {
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
          amount: netSales,
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
      return {
        error: `No se pudo agregar el producto: ${itemError?.message ?? "no se pudo insertar el ítem"}`,
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
        await supabase.from("order_items").delete().eq("id", insertedItem.id);
        return { error: `No se pudo agregar el producto: ${addonsError.message}` };
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

  if (updateError) return { error: "No se pudieron actualizar los totales" };

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { subtotal: newSubtotal, total: newTotal };
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

  if (error) return { error: `No se pudo actualizar el pedido: ${error.message}` };

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
