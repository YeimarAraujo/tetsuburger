import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AddonAvailabilityMap = Map<string, boolean>;

/**
 * Calcula, en una sola pasada, la disponibilidad de cada adición para un
 * conjunto de productos.
 *
 * Criterio "base + adición combinados": una adición está disponible solo si el
 * stock de cada insumo alcanza para consumir UNA unidad del producto base más
 * esa adición. El total del pedido se valida de nuevo al entregar.
 *
 * Devuelve solo booleanos por adición — NUNCA expone el stock crudo.
 */
export async function getAddonsAvailability(
  productIds: string[]
): Promise<Map<string, AddonAvailabilityMap>> {
  const result = new Map<string, AddonAvailabilityMap>();
  if (productIds.length === 0) return result;

  const supabase = createAdminClient();

  // Consumo de la receta base por producto (por unidad)
  const { data: productCons } = await supabase
    .from("product_consumptions")
    .select("product_id, inventory_item_id, quantity")
    .in("product_id", productIds);

  const productNeeds = new Map<string, Map<string, number>>();
  for (const row of productCons ?? []) {
    let list = productNeeds.get(row.product_id);
    if (!list) {
      list = new Map<string, number>();
      productNeeds.set(row.product_id, list);
    }
    list.set(row.inventory_item_id, Number(row.quantity));
  }

  // Consumo por adición
  const { data: addonCons } = await supabase
    .from("addon_consumptions")
    .select("addon_id, inventory_item_id, quantity");
  const addonConsByAddon = new Map<string, Map<string, number>>();
  for (const c of addonCons ?? []) {
    const list = addonConsByAddon.get(c.addon_id) ?? new Map<string, number>();
    list.set(c.inventory_item_id, Number(c.quantity));
    addonConsByAddon.set(c.addon_id, list);
  }

  // Todos los insumos relevantes (base + adiciones) para leer su stock
  const relevantItemIds = new Set<string>();
  for (const list of productNeeds.values()) for (const k of list.keys()) relevantItemIds.add(k);
  for (const list of addonConsByAddon.values()) for (const k of list.keys()) relevantItemIds.add(k);

  const stock = new Map<string, number>();
  if (relevantItemIds.size > 0) {
    const { data: items } = await supabase
      .from("inventory_items")
      .select("id, current_stock")
      .in("id", [...relevantItemIds]);
    for (const i of items ?? []) stock.set(i.id, Number(i.current_stock ?? 0));
  }

  for (const productId of productIds) {
    const base = productNeeds.get(productId);
    if (!base || base.size === 0) {
      // Sin receta base: no se puede evaluar la adición en conjunto.
      result.set(productId, new Map());
      continue;
    }

    const perAddon = new Map<string, boolean>();
    for (const [addonId, needs] of addonConsByAddon) {
      let ok = true;
      for (const [itemId, addonQty] of needs) {
        const baseQty = base.get(itemId) ?? 0;
        const required = baseQty + addonQty;
        if ((stock.get(itemId) ?? 0) < required) {
          ok = false;
          break;
        }
      }
      perAddon.set(addonId, ok);
    }
    result.set(productId, perAddon);
  }

  return result;
}
