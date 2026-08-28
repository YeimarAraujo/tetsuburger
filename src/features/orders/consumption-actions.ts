"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  error?: string;
}

export interface ConsumptionBreakDownItem {
  inventoryItemId: string;
  name: string;
  unit: string;
  autoNeeded: number;
  overrideQty: number | null;
  references: string[];
}

/**
 * Devuelve el desglose de consumo que se aplicará a un pedido, combinando la
 * receta base + adiciones (autoNeeded) con los ajustes manuales (overrideQty).
 * Se usa para mostrar/editar los consumos en el board antes de ENTREGADO.
 */
export async function getOrderConsumptionBreakdown(
  orderId: string
): Promise<{ items?: ConsumptionBreakDownItem[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const admin = createAdminClient();

  const { data: orderItems } = await admin
    .from("order_items")
    .select("id, product_id, product_name, quantity")
    .eq("order_id", orderId);
  const items = (orderItems ?? []) as Array<{
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
  }>;
  if (items.length === 0) return { items: [] };

  const productIds = [
    ...new Set(items.map((i) => i.product_id).filter(Boolean)),
  ] as string[];
  const itemIds = items.map((i) => i.id);

  // Map: inventory_item_id -> { name, unit, autoNeeded, references }
  const breakdown = new Map<
    string,
    { name: string; unit: string; autoNeeded: number; references: string[] }
  >();

  if (productIds.length > 0) {
    const { data: cons } = await admin
      .from("product_consumptions")
      .select("product_id, inventory_item_id, quantity, item:inventory_items(name, unit)")
      .in("product_id", productIds);
    const consRows = (cons ?? []) as Array<{
      product_id: string;
      inventory_item_id: string;
      quantity: number;
      item?: { name: string; unit: string } | { name: string; unit: string }[] | null;
    }>;
    for (const item of items) {
      if (!item.product_id) continue;
      for (const c of consRows) {
        if (c.product_id !== item.product_id) continue;
        const inv = c.item && !Array.isArray(c.item) ? c.item : null;
        const ref = `${item.product_name} x${item.quantity}`;
        const existing = breakdown.get(c.inventory_item_id) ?? {
          name: inv?.name ?? "Insumo",
          unit: inv?.unit ?? "unidad",
          autoNeeded: 0,
          references: [],
        };
        existing.autoNeeded += Number(c.quantity) * item.quantity;
        if (!existing.references.includes(ref)) existing.references.push(ref);
        breakdown.set(c.inventory_item_id, existing);
      }
    }
  }

  if (itemIds.length > 0) {
    const { data: addons } = await admin
      .from("order_item_addons")
      .select("order_item_id, addon_id, addon_name, quantity")
      .in("order_item_id", itemIds);
    const addonRows = (addons ?? []) as Array<{
      order_item_id: string;
      addon_id: string | null;
      addon_name: string;
      quantity: number;
    }>;
    const addonIds = [...new Set(addonRows.map((a) => a.addon_id).filter(Boolean))] as string[];
    if (addonIds.length > 0) {
      const { data: acons } = await admin
        .from("addon_consumptions")
        .select("addon_id, inventory_item_id, quantity, item:inventory_items(name, unit)")
        .in("addon_id", addonIds);
      const aconsRows = (acons ?? []) as Array<{
        addon_id: string;
        inventory_item_id: string;
        quantity: number;
        item?: { name: string; unit: string } | { name: string; unit: string }[] | null;
      }>;
      for (const row of addonRows) {
        const itemQty = items.find((i) => i.id === row.order_item_id)?.quantity ?? 1;
        const ref = `+ ${row.addon_name}`;
        for (const c of aconsRows) {
          if (c.addon_id !== row.addon_id) continue;
          const inv = c.item && !Array.isArray(c.item) ? c.item : null;
          const existing = breakdown.get(c.inventory_item_id) ?? {
            name: inv?.name ?? "Insumo",
            unit: inv?.unit ?? "unidad",
            autoNeeded: 0,
            references: [],
          };
          existing.autoNeeded += Number(c.quantity) * (row.quantity || 1) * itemQty;
          if (!existing.references.includes(ref)) existing.references.push(ref);
          breakdown.set(c.inventory_item_id, existing);
        }
      }
    }
  }

  // Overrides existentes
  const { data: overrides } = await admin
    .from("order_consumption_overrides")
    .select("inventory_item_id, quantity")
    .eq("order_id", orderId);
  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.inventory_item_id, Number(o.quantity)])
  );

  const result: ConsumptionBreakDownItem[] = [];
  for (const [itemId, b] of breakdown) {
    result.push({
      inventoryItemId: itemId,
      name: b.name,
      unit: b.unit,
      autoNeeded: b.autoNeeded,
      overrideQty: overrideMap.get(itemId) ?? null,
      references: b.references,
    });
  }
  // Overrides que apuntan a un insumo sin cálculo automático
  for (const [itemId, qty] of overrideMap) {
    if (!breakdown.has(itemId)) {
      result.push({
        inventoryItemId: itemId,
        name: "Insumo",
        unit: "unidad",
        autoNeeded: 0,
        overrideQty: qty,
        references: ["Ajuste manual"],
      });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name));

  return { items: result };
}

const overrideSchema = z.object({
  orderId: z.string().uuid(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid("Insumo inválido"),
        quantity: z.coerce.number().min(0, "La cantidad no puede ser negativa"),
      })
    )
    .max(200),
});

/**
 * Guarda los ajustes de consumo de un pedido (sin tomate → 0, extra → +N).
 * Reemplaza TODOS los overrides del pedido por los enviados.
 * quantity = 0 en un insumo lo retira (no se descuenta).
 */
export async function saveOrderConsumptionOverrides(
  orderId: string,
  items: Array<{ inventoryItemId: string; quantity: number }>
): Promise<ActionResult> {
  const parsed = overrideSchema.safeParse({ orderId, items });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  // Borra todos los overrides actuales del pedido y guarda los nuevos
  const { error: delErr } = await supabase
    .from("order_consumption_overrides")
    .delete()
    .eq("order_id", parsed.data.orderId);
  if (delErr) return { error: "No se pudo actualizar los consumos" };

  const nonZero = parsed.data.items.filter((i) => i.quantity > 0);
  if (nonZero.length > 0) {
    const { error: insErr } = await supabase
      .from("order_consumption_overrides")
      .insert(
        nonZero.map((i) => ({
          order_id: parsed.data.orderId,
          inventory_item_id: i.inventoryItemId,
          quantity: i.quantity,
        }))
      );
    if (insErr) return { error: "No se pudieron guardar los consumos" };
  }

  revalidatePath("/admin/pedidos");
  return {};
}
