import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import {
  PromotionManager,
  type GiftStat,
  type PromotionProduct,
  type PromotionRuleRow,
} from "@/components/admin/promotions/promotion-manager";

export const metadata = {
  title: "Promociones · TETSU BURGER Admin",
};

const DAYS_BACK = 30;

type MaybeArray<T> = T | T[] | null | undefined;

export default async function PromotionsPage() {
  const supabase = await createClient();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - DAYS_BACK);
  const since = sinceDate.toISOString();

  const [rulesRes, productsRes, giftsRes] = await Promise.all([
    supabase
      .from("promotion_rules")
      .select(
        "id, name, min_total, free_delivery, is_active, gifts:promotion_rule_gifts(id, product_id, is_active)"
      )
      .order("min_total"),
    supabase.from("products").select("id, name, cost, is_active").order("name"),
    supabase
      .from("order_items")
      .select("product_name, quantity, unit_cost, orders!inner(status, created_at)")
      .eq("is_gift", true)
      .gte("orders.created_at", since)
      .neq("orders.status", "CANCELADO"),
  ]);

  // Migración 0037 sin aplicar: se avisa en vez de romper la página.
  if (rulesRes.error) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
        <PageHeader
          title="Promociones"
          description="Regalos y domicilio gratis por monto de compra."
        />
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          No se pudieron leer las promociones. Verifica que la migración{" "}
          <code>0037_promotions.sql</code> esté aplicada en Supabase.
        </div>
      </div>
    );
  }

  const rules: PromotionRuleRow[] = (rulesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? "",
    min_total: Number(r.min_total),
    free_delivery: r.free_delivery === true,
    is_active: r.is_active === true,
    gifts: ((r.gifts ?? []) as PromotionRuleRow["gifts"]).slice(),
  }));

  const products: PromotionProduct[] = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    cost: Number(p.cost) || 0,
    is_active: p.is_active === true,
  }));

  const byName = new Map<string, GiftStat>();
  for (const row of (giftsRes.data ?? []) as {
    product_name: string;
    quantity: number;
    unit_cost: number;
    orders: MaybeArray<{ status: string; created_at: string }>;
  }[]) {
    const qty = Number(row.quantity) || 0;
    const entry = byName.get(row.product_name) ?? {
      name: row.product_name,
      count: 0,
      cost: 0,
    };
    entry.count += qty;
    entry.cost += (Number(row.unit_cost) || 0) * qty;
    byName.set(row.product_name, entry);
  }
  const stats = [...byName.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Promociones"
        description="Regalos y domicilio gratis por monto de compra. Se aplican solo a pedidos de la web."
      />

      <PromotionManager rules={rules} products={products} stats={stats} />
    </div>
  );
}
