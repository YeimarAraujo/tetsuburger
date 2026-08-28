import { createAdminClient } from "@/lib/supabase/admin";

export interface ConsumptionResult {
  error?: string;
  applied?: boolean;
  missing?: Array<{ name: string; unit: string; needed: number; available: number }>;
}

interface NeededEntry {
  name: string;
  unit: string;
  available: number;
  needed: number;
  references: string[];
}

/**
 * Suma una necesidad de insumo al Map, unificando por inventory_item_id.
 */
function addNeed(
  neededMap: Map<string, NeededEntry>,
  inventoryItemId: string,
  name: string,
  unit: string,
  available: number,
  need: number,
  ref: string
) {
  const entry = neededMap.get(inventoryItemId);
  if (entry) {
    entry.needed = entry.needed + need;
    if (!entry.references.includes(ref)) entry.references.push(ref);
  } else {
    neededMap.set(inventoryItemId, {
      name,
      unit,
      available,
      needed: need,
      references: [ref],
    });
  }
}

/**
 * Calcula cuánto de cada insumo consume un pedido.
 * Considera: receta base de cada producto + consumo de cada adición
 * + ajustes manuales por pedido (order_consumption_overrides).
 * Devuelve un Map insumoId -> { name, unit, available, needed, references }.
 */
async function computeNeeded(
  orderId: string
): Promise<{ map: Map<string, NeededEntry>; error?: string; missing?: ConsumptionResult["missing"] }> {
  const supabase = createAdminClient();

  // Items del pedido
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, product_id, product_name, quantity")
    .eq("order_id", orderId);

  const items = (orderItems ?? []) as {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
  }[];

  if (items.length === 0) return { map: new Map() };

  const productIds = [...new Set(
    items.map((i) => i.product_id).filter((p): p is string => Boolean(p))
  )];

  const itemIds = items.map((i) => i.id);

  const neededMap = new Map<string, NeededEntry>();

  // ---- Receta base de cada producto
  if (productIds.length > 0) {
    const { data: consumptions, error: consError } = await supabase
      .from("product_consumptions")
      .select("product_id, inventory_item_id, quantity, item:inventory_items(name, unit, current_stock)")
      .in("product_id", productIds);

    if (consError) return { map: new Map(), error: "Error al leer los consumos del producto" };

    const consumptionRows = (consumptions ?? []) as Array<{
      product_id: string;
      inventory_item_id: string;
      quantity: number;
      item?: { name: string; unit: string; current_stock: number } | { name: string; unit: string; current_stock: number }[] | null;
    }>;

    for (const item of items) {
      if (!item.product_id) continue;
      const productCons = consumptionRows.filter(
        (c) => c.product_id === item.product_id
      );
      for (const c of productCons) {
        const inv = c.item && !Array.isArray(c.item) ? c.item : null;
        addNeed(
          neededMap,
          c.inventory_item_id,
          inv?.name ?? "Insumo",
          inv?.unit ?? "unidad",
          Number(inv?.current_stock ?? 0),
          Number(c.quantity) * item.quantity,
          `${item.product_name} x${item.quantity}`
        );
      }
    }
  }

  // ---- Adiciones: cada adicional extra consume sus propios insumos
  if (itemIds.length > 0) {
    const { data: addonsData, error: addonsError } = await supabase
      .from("order_item_addons")
      .select("order_item_id, addon_id, addon_name, quantity")
      .in("order_item_id", itemIds);

    if (!addonsError) {
      const addonRows = (addonsData ?? []) as Array<{
        order_item_id: string;
        addon_id: string | null;
        addon_name: string;
        quantity: number;
      }>;
      const addonIds = [...new Set(addonRows.map((a) => a.addon_id).filter(Boolean))] as string[];

      if (addonIds.length > 0) {
        const { data: addonCons, error: acError } = await supabase
          .from("addon_consumptions")
          .select("addon_id, inventory_item_id, quantity, item:inventory_items(name, unit, current_stock)")
          .in("addon_id", addonIds);

        if (!acError) {
          const addonConsRows = (addonCons ?? []) as Array<{
            addon_id: string;
            inventory_item_id: string;
            quantity: number;
            item?: { name: string; unit: string; current_stock: number } | { name: string; unit: string; current_stock: number }[] | null;
          }>;

          for (const row of addonRows) {
            const itemQty = items.find((i) => i.id === row.order_item_id)?.quantity ?? 1;
            const cons = addonConsRows.filter((c) => c.addon_id === row.addon_id);
            for (const c of cons) {
              const inv = c.item && !Array.isArray(c.item) ? c.item : null;
              addNeed(
                neededMap,
                c.inventory_item_id,
                inv?.name ?? "Insumo",
                inv?.unit ?? "unidad",
                Number(inv?.current_stock ?? 0),
                Number(c.quantity) * (row.quantity || 1) * itemQty,
                `+ ${row.addon_name}`
              );
            }
          }
        }
      }
    }
  }

  // ---- Ajustes manuales por pedido (sin tomate → 0, extra → +N)
  const { data: overrides, error: overridesError } = await supabase
    .from("order_consumption_overrides")
    .select("inventory_item_id, quantity")
    .eq("order_id", orderId);

  if (!overridesError) {
    for (const ov of overrides ?? []) {
      const entry = neededMap.get(ov.inventory_item_id);
      const qty = Number(ov.quantity);
      if (entry) {
        if (qty <= 0) {
          neededMap.delete(ov.inventory_item_id);
        } else {
          entry.needed = qty;
        }
      } else if (qty > 0) {
        neededMap.set(ov.inventory_item_id, {
          name: "Insumo",
          unit: "unidad",
          available: 0,
          needed: qty,
          references: ["Ajuste manual"],
        });
      }
    }
  }

  // Detectar faltantes
  const missing: ConsumptionResult["missing"] = [];
  for (const entry of neededMap.values()) {
    if (entry.needed > entry.available) {
      missing.push({
        name: entry.name,
        unit: entry.unit,
        needed: entry.needed,
        available: entry.available,
      });
    }
  }

  return { map: neededMap, missing: missing.length ? missing : undefined };
}

/**
 * Valida que haya stock suficiente para preparar el pedido.
 * No descuenta nada. Devuelve error si falta algún insumo.
 */
export async function validateStockForOrder(
  orderId: string
): Promise<ConsumptionResult> {
  const { error, missing } = await computeNeeded(orderId);
  if (error) return { error };
  if (missing && missing.length > 0) {
    const msg = missing
      .map((m) => `${m.name}: necesitas ${m.needed}${m.unit}, hay ${m.available}${m.unit}`)
      .join(". ");
    return {
      error: `Stock insuficiente. ${msg}. Repón inventario para preparar el pedido.`,
      missing,
    };
  }
  // Aunque no haya consumos configurados, permitimos preparar.
  return { applied: true };
}

/**
 * Descuenta del inventario los insumos consumidos por un pedido al prepararse.
 * Idempotente: si ya hay logs de consumo, no vuelve a descontar.
 */
export async function consumeInventoryForOrder(
  orderId: string
): Promise<ConsumptionResult> {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", orderId)
    .single();

  if (!order) return { error: "Pedido no encontrado" };

  // Idempotencia: ya fue consumido?
  const { data: existingLogs } = await supabase
    .from("order_consumption_logs")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);

  if (existingLogs && existingLogs.length > 0) {
    return { applied: true };
  }

  const { map, error, missing } = await computeNeeded(orderId);
  if (error) return { error };
  if (missing && missing.length > 0) {
    const msg = missing
      .map((m) => `${m.name}: necesitas ${m.needed}${m.unit}, hay ${m.available}${m.unit}`)
      .join(". ");
    return {
      error: `Stock insuficiente. ${msg}. Repón inventario para preparar el pedido.`,
      missing,
    };
  }

  if (map.size === 0) return { applied: true };

  // Aplicar descuento: movimiento SALIDA + actualizar stock + log inmutable
  const orderRef = String(order.order_number).padStart(5, "0");

  for (const [itemId, entry] of map) {
    await supabase.from("inventory_movements").insert({
      inventory_item_id: itemId,
      movement_type: "SALIDA",
      quantity: entry.needed,
      reference: `Pedido #${orderRef}`,
    });

    const newStock = Math.max(0, entry.available - entry.needed);
    await supabase
      .from("inventory_items")
      .update({ current_stock: newStock })
      .eq("id", itemId);

    await supabase.from("order_consumption_logs").insert({
      order_id: orderId,
      inventory_item_id: itemId,
      quantity: entry.needed,
      product_reference: entry.references.join(", "),
    });
  }

  return { applied: true };
}
