import { createAdminClient } from "@/lib/supabase/admin";

export interface CogsResult {
  map: Map<string, number>;
  missingCostCount: number;
}

/** Pedidos por consulta: evita URLs muy largas y el tope de 1.000 filas. */
const CHUNK = 150;

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

interface ItemRow {
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_cost?: number | string | null;
  order_item_addons?: {
    unit_cost: number | string | null;
    quantity: number | null;
    target: string | null;
    components_qty: number | null;
  }[];
}

/**
 * Costo de lo vendido (COGS) por pedido. La decisión de qué pedidos contar
 * (ENTREGADO) la toma cada llamador.
 *
 * - Con la migración 0033: usa el costo guardado al momento de la venta en
 *   cada línea (order_items.unit_cost) y en cada adicional.
 * - Sin ella, o si la línea no tiene costo guardado: products.cost actual.
 * - missingCostCount cuenta líneas sin costo (la utilidad puede estar
 *   sobreestimada por falta de datos).
 */
export async function getCogsForOrders(orderIds: string[]): Promise<CogsResult> {
  const supabase = createAdminClient();
  if (orderIds.length === 0) return { map: new Map(), missingCostCount: 0 };

  let snapshot = true;
  const rows: ItemRow[] = [];

  for (const ids of chunks(orderIds, CHUNK)) {
    const res = snapshot
      ? await supabase
          .from("order_items")
          .select("order_id, product_id, quantity, unit_cost, order_item_addons(unit_cost, quantity, target, components_qty)")
          .in("order_id", ids)
      : null;

    if (res && !res.error) {
      rows.push(...((res.data ?? []) as unknown as ItemRow[]));
      continue;
    }

    // Columna inexistente (migración 0033 sin aplicar): consulta anterior.
    snapshot = false;
    const { data } = await supabase
      .from("order_items")
      .select("order_id, product_id, quantity")
      .in("order_id", ids);
    rows.push(...((data ?? []) as unknown as ItemRow[]));
  }

  const productIds = [
    ...new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id))),
  ];
  const costById = new Map<string, number>();
  for (const ids of chunks(productIds, CHUNK)) {
    const { data: products } = await supabase.from("products").select("id, cost").in("id", ids);
    for (const p of products ?? []) costById.set(p.id, Number(p.cost) || 0);
  }

  const map = new Map<string, number>();
  let missingCostCount = 0;
  for (const r of rows) {
    const qty = Number(r.quantity) || 0;
    const saved = Number(r.unit_cost) || 0;
    const unit = saved > 0 ? saved : r.product_id ? costById.get(r.product_id) ?? 0 : 0;
    if (r.product_id && unit <= 0) missingCostCount++;

    const addonsPerUnit = (r.order_item_addons ?? []).reduce(
      (s, a) =>
        s +
        (Number(a.unit_cost) || 0) *
          (Number(a.quantity) || 1) *
          (a.target === "EACH" ? Number(a.components_qty) || 1 : 1),
      0
    );

    map.set(r.order_id, (map.get(r.order_id) ?? 0) + (unit + addonsPerUnit) * qty);
  }

  return { map, missingCostCount };
}

/** Suma los valores de un mapa de COGS por pedido. */
export function sumCogs(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}
