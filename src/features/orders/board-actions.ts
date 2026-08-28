"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeInventoryForOrder, validateStockForOrder } from "@/features/orders/consumption";

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

  // El trigger registra historial y timestamps automáticamente.
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return {};
}
