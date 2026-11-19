import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applicableRules,
  resolvePromotions,
  type PromotionRule,
  type ResolvedPromotions,
} from "@/lib/promotions";
import type { PreparedLine } from "@/features/orders/order-builder";

/**
 * Lado servidor de las promociones: lee las reglas completas (con los regalos,
 * que NO son públicos), revisa el stock y sortea el regalo. Solo lo usa
 * placeOrder; la decisión nunca se toma en el navegador.
 */

type MaybeArray<T> = T | T[] | null | undefined;

function one<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function loadPromotionRules(): Promise<PromotionRule[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("promotion_rules")
    .select(
      "id, min_total, free_delivery, gifts:promotion_rule_gifts(product_id, is_active, product:products(name, is_active))"
    )
    .eq("is_active", true);

  if (error) {
    // Migración 0037 sin aplicar u otro fallo: el pedido sigue sin promoción.
    console.error("promotions: no se pudieron leer las reglas", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const gifts = (
      (row.gifts ?? []) as {
        product_id: string;
        is_active: boolean;
        product: MaybeArray<{ name: string; is_active: boolean }>;
      }[]
    ).flatMap((g) => {
      const product = one(g.product);
      if (!g.is_active || !product?.is_active) return [];
      return [{ productId: g.product_id, productName: product.name }];
    });

    return {
      id: row.id as string,
      minTotal: Number(row.min_total),
      freeDelivery: row.free_delivery === true,
      gifts,
    };
  });
}

interface ConsumptionRow {
  product_id: string;
  inventory_item_id: string;
  quantity: number;
  item: MaybeArray<{ current_stock: number }>;
}

interface AddonConsumptionRow {
  addon_id: string;
  inventory_item_id: string;
  quantity: number;
}

/**
 * Qué productos de regalo se pueden entregar con el inventario actual.
 * Cuenta también lo que el propio pedido ya va a consumir: si el cliente pide
 * una gaseosa y el regalo es otra, ambas salen del mismo insumo, y mirar solo
 * el regalo dejaría pasar un pedido que luego se bloquearía al prepararlo con
 * "Stock insuficiente". Un regalo sin receta no descuenta inventario y siempre
 * se puede entregar.
 */
async function giftProductsInStock(
  lines: PreparedLine[],
  giftProductIds: string[]
): Promise<Set<string>> {
  const available = new Set<string>();
  if (giftProductIds.length === 0) return available;

  const supabase = createAdminClient();
  const allProductIds = [
    ...new Set([...lines.map((l) => l.productId), ...giftProductIds]),
  ];
  const addonIds = [
    ...new Set(lines.flatMap((l) => l.addons.map((a) => a.id))),
  ];

  const [productRes, addonRes] = await Promise.all([
    supabase
      .from("product_consumptions")
      .select(
        "product_id, inventory_item_id, quantity, item:inventory_items(current_stock)"
      )
      .in("product_id", allProductIds),
    addonIds.length > 0
      ? supabase
          .from("addon_consumptions")
          .select("addon_id, inventory_item_id, quantity")
          .in("addon_id", addonIds)
      : Promise.resolve({ data: [] as AddonConsumptionRow[], error: null }),
  ]);

  if (productRes.error || addonRes.error) {
    // Sin poder verificar el stock no se regala: mejor que bloquear un pedido.
    console.error("promotions: no se pudo verificar el stock del regalo", {
      product: productRes.error,
      addon: addonRes.error,
    });
    return available;
  }

  const productRows = (productRes.data ?? []) as ConsumptionRow[];
  const addonRows = (addonRes.data ?? []) as AddonConsumptionRow[];

  const needs = new Map<string, number>();
  const addNeed = (itemId: string, qty: number) =>
    needs.set(itemId, (needs.get(itemId) ?? 0) + qty);

  for (const line of lines) {
    for (const c of productRows) {
      if (c.product_id === line.productId) {
        addNeed(c.inventory_item_id, Number(c.quantity) * line.quantity);
      }
    }
    for (const addon of line.addons) {
      const perUnit =
        (addon.quantity ?? 1) *
        (addon.target === "EACH" ? (addon.components ?? 1) : 1) *
        line.quantity;
      for (const c of addonRows) {
        if (c.addon_id === addon.id) {
          addNeed(c.inventory_item_id, Number(c.quantity) * perUnit);
        }
      }
    }
  }

  for (const giftId of giftProductIds) {
    const recipe = productRows.filter((c) => c.product_id === giftId);
    const fits = recipe.every((c) => {
      const stock = Number(one(c.item)?.current_stock ?? 0);
      return (needs.get(c.inventory_item_id) ?? 0) + Number(c.quantity) <= stock;
    });
    if (fits) available.add(giftId);
  }

  return available;
}

/**
 * Domicilio gratis y regalo que le corresponden a un pedido web.
 * Si algo falla, el pedido sigue sin promoción (nunca se bloquea una venta).
 */
export async function resolveOrderPromotions(params: {
  subtotal: number;
  deliveryType: "DOMICILIO" | "RECOGIDA";
  lines: PreparedLine[];
}): Promise<ResolvedPromotions> {
  const none: ResolvedPromotions = { freeDelivery: false, gift: null };

  try {
    const rules = await loadPromotionRules();
    if (rules.length === 0) return none;

    const reached = applicableRules(rules, params.subtotal);
    const giftIds = [
      ...new Set(reached.flatMap((r) => r.gifts.map((g) => g.productId))),
    ];
    const inStock = await giftProductsInStock(params.lines, giftIds);

    return resolvePromotions(
      rules,
      params.subtotal,
      params.deliveryType,
      (productId) => inStock.has(productId),
      (n) => randomInt(n)
    );
  } catch (error) {
    console.error("promotions: error al resolver promociones", error);
    return none;
  }
}
