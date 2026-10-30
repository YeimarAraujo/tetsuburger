import { createClient } from "@/lib/supabase/server";
import { ReportsManager, type HistoryOrder } from "@/components/admin/reports-manager";
import { PageHeader } from "@/components/admin/page-header";
import { fetchExpenses } from "@/features/finance/expenses";
import { bogotaToday } from "@/lib/bogota";
import {
  EMPTY_REPORT,
  parseSalesReport,
  previousRange,
  type SalesReport,
} from "@/lib/sales-analytics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reportes · TETSU BURGER Admin",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Tope del historial en pantalla (el CSV exporta todo el período). */
const HISTORY_LIMIT = 1000;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const today = bogotaToday();
  const monthStart = `${today.slice(0, 8)}01`;

  const rawFrom = typeof params.from === "string" ? params.from : "";
  const rawTo = typeof params.to === "string" ? params.to : "";
  let from = DATE_RE.test(rawFrom) ? rawFrom : monthStart;
  let to = DATE_RE.test(rawTo) ? rawTo : today;
  if (from > to) [from, to] = [to, from];
  const category = typeof params.cat === "string" && params.cat ? params.cat : "todas";

  const prev = previousRange(from, to);
  const supabase = await createClient();

  const [currentRes, previousRes, ordersRes, expenses, categoriesRes, productionRes] =
    await Promise.all([
      supabase.rpc("sales_report", { p_from: from, p_to: to }),
      supabase.rpc("sales_report", { p_from: prev.from, p_to: prev.to }),
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, subtotal, final_adjustment, payment_method, origin, created_at, items:order_items(quantity, product:products(conteo_hamburguesas, conteo_perros))"
        )
        .eq("status", "ENTREGADO")
        .gte("created_at", `${from}T00:00:00-05:00`)
        .lte("created_at", `${to}T23:59:59-05:00`)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      fetchExpenses(supabase, from, to),
      supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
      supabase
        .from("production_records")
        .select("id, record_date, description, quantity, unit, unit_cost, total_cost, item:inventory_items(name)")
        .gte("record_date", from)
        .lte("record_date", to)
        .order("record_date", { ascending: false }),
    ]);

  // Sin la migración 0033 la función no existe: se muestra un aviso.
  const reportError = currentRes.error;
  if (reportError && reportError.code !== "PGRST202") {
    console.error("sales_report failed", reportError);
  }
  const report: SalesReport = reportError ? EMPTY_REPORT : parseSalesReport(currentRes.data);
  const previous: SalesReport = previousRes.error ? EMPTY_REPORT : parseSalesReport(previousRes.data);

  const orders: HistoryOrder[] = (
    (ordersRes.data ?? []) as unknown as {
      id: string;
      order_number: number;
      customer_name: string;
      subtotal: number | string;
      final_adjustment: number | string | null;
      payment_method: string | null;
      origin: string;
      created_at: string;
      items?: {
        quantity: number;
        product?: { conteo_hamburguesas: number; conteo_perros: number } | null;
      }[];
    }[]
  ).map((o) => {
    const counts = (o.items ?? []).reduce(
      (acc, i) => {
        const product = i.product && !Array.isArray(i.product) ? i.product : null;
        acc.hamburguesas += (Number(product?.conteo_hamburguesas) || 0) * Number(i.quantity);
        acc.perros += (Number(product?.conteo_perros) || 0) * Number(i.quantity);
        return acc;
      },
      { hamburguesas: 0, perros: 0 }
    );
    return {
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      subtotal: Number(o.subtotal),
      net: Number(o.subtotal) - Number(o.final_adjustment ?? 0),
      payment_method: o.payment_method,
      origin: o.origin,
      created_at: o.created_at,
      ...counts,
    };
  });

  const production = (
    (productionRes.data ?? []) as unknown as {
      id: string;
      record_date: string;
      description: string;
      quantity: number;
      unit: string;
      unit_cost: number | string;
      total_cost: number | string;
      item?: { name: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    record_date: r.record_date,
    description: r.description,
    quantity: Number(r.quantity),
    unit: r.unit,
    unit_cost: Number(r.unit_cost),
    total_cost: Number(r.total_cost),
    itemName: r.item && !Array.isArray(r.item) ? r.item.name : null,
  }));

  const categories = ((categoriesRes.data ?? []) as { id: number; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const filteredExpenses =
    category === "todas"
      ? expenses
      : expenses.filter((e) => String(e.expense_category_id) === category);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Reportes"
        description="Ventas entregadas, productos, gastos y compras del período"
      />

      <ReportsManager
        report={report}
        previous={previous}
        reportUnavailable={Boolean(reportError)}
        orders={orders}
        historyTruncated={orders.length >= HISTORY_LIMIT}
        expenses={filteredExpenses}
        production={production}
        categories={categories}
        filters={{ from, to, category }}
      />
    </div>
  );
}
