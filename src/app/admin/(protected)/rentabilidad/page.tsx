import { createClient } from "@/lib/supabase/server";
import { getBusinessCosts } from "@/features/rentabilidad/actions";
import { fetchExpenses } from "@/features/finance/expenses";
import {
  RentabilidadManager,
  type AddonRow,
  type RentabilidadRow,
} from "@/components/admin/rentabilidad/rentabilidad-manager";
import { PageHeader } from "@/components/admin/page-header";
import { bogotaToday } from "@/lib/bogota";
import { addDays, parseSalesReport, suggestFixedCosts } from "@/lib/sales-analytics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rentabilidad · TETSU BURGER Admin",
};

export default async function RentabilidadPage() {
  const supabase = await createClient();
  const today = bogotaToday();
  const from30 = addDays(today, -29);
  const from90 = addDays(today, -89);

  const [productsRes, addonsRes, reportRes, expenses, initialConfig] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, cost, packaging_cost, category:categories(name), product_consumptions(count)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("addons")
      .select("id, name, price, addon_consumptions(quantity, item:inventory_items(cost))")
      .eq("is_active", true)
      .order("name"),
    supabase.rpc("sales_report", { p_from: from30, p_to: today }),
    fetchExpenses(supabase, from90, today),
    getBusinessCosts(),
  ]);

  const report = reportRes.error ? null : parseSalesReport(reportRes.data);
  const unitsByProduct = new Map((report?.products ?? []).map((p) => [p.product_id, p.units]));
  const unitsByAddon = new Map((report?.addons ?? []).map((a) => [a.key, a.units]));

  const products: RentabilidadRow[] = (
    (productsRes.data ?? []) as unknown as {
      id: string;
      name: string;
      price: number | string;
      cost: number | string;
      packaging_cost: number | string;
      category?: { name: string } | null;
      product_consumptions?: { count: number }[];
    }[]
  ).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    cost: Number(p.cost),
    packaging_cost: Number(p.packaging_cost ?? 0),
    category: p.category && !Array.isArray(p.category) ? p.category.name : null,
    hasRecipe: Number(p.product_consumptions?.[0]?.count ?? 0) > 0,
    sold30: unitsByProduct.get(p.id) ?? 0,
  }));

  const addons: AddonRow[] = (
    (addonsRes.data ?? []) as unknown as {
      id: string;
      name: string;
      price: number | string;
      addon_consumptions?: { quantity: number; item?: { cost: number } | null }[];
    }[]
  ).map((a) => {
    const consumptions = a.addon_consumptions ?? [];
    return {
      id: a.id,
      name: a.name,
      price: Number(a.price),
      cost: consumptions.reduce((s, c) => s + Number(c.quantity) * (Number(c.item?.cost) || 0), 0),
      hasRecipe: consumptions.length > 0,
      sold30: unitsByAddon.get(a.id) ?? 0,
    };
  });

  const suggestion = suggestFixedCosts(
    expenses.map((e) => ({
      category: e.category?.name ?? null,
      amount: e.amount,
      includedInProductCost: e.includedInProductCost,
    })),
    3
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Rentabilidad"
        description="Costo completo por producto, precio sugerido y simulador con tus ventas y gastos reales"
      />
      <RentabilidadManager
        products={products}
        addons={addons}
        initialConfig={initialConfig}
        real={
          report
            ? { sales30: report.totals.sales, cost30: report.totals.cost, orders30: report.totals.orders }
            : null
        }
        suggestion={suggestion}
      />
    </div>
  );
}
