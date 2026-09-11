import { createAdminClient } from "@/lib/supabase/admin";

export interface CogsResult {
  map: Map<string, number>;
  missingCostCount: number;
}

/**
 * Calcula el costo de lo vendido (COGS) por pedido a partir de los productos
 * vendidos (order_items.product_id) y su costo registrado (products.cost).
 * Sólo sirve como base de cálculo: la decisión de qué pedidos contar
 * (ENTREGADO) la toma cada llamador.
 *
 * - COGS por pedido = Σ (products.cost × order_items.quantity)
 * - Los items sin product_id se omiten (productos personalizados sin costo).
 * - Los productos con cost = 0 incrementan missingCostCount para advertir
 *   que la utilidad puede estar sobreestimada por falta de datos.
 */
export async function getCogsForOrders(
  orderIds: string[]
): Promise<CogsResult> {
  const supabase = createAdminClient();
  if (orderIds.length === 0) return { map: new Map(), missingCostCount: 0 };

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, product_id, quantity")
    .in("order_id", orderIds);

  const rows = (items ?? []) as Array<{
    order_id: string;
    product_id: string | null;
    quantity: number;
  }>;

  const productIds = [
    ...new Set(rows.map((r) => r.product_id).filter(Boolean)),
  ] as string[];

  const costById = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, cost")
      .in("id", productIds);
    for (const p of products ?? []) costById.set(p.id, Number(p.cost) || 0);
  }

  const map = new Map<string, number>();
  let missingCostCount = 0;
  for (const r of rows) {
    if (!r.product_id) continue;
    const cost = costById.get(r.product_id) ?? 0;
    const line = Number(r.quantity) * cost;
    map.set(r.order_id, (map.get(r.order_id) ?? 0) + line);
    if (cost <= 0) missingCostCount++;
  }

  return { map, missingCostCount };
}

/** Suma los valores de un mapa de COGS por pedido. */
export function sumCogs(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}