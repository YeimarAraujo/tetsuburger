import { createClient } from "@/lib/supabase/server";
import { getCogsForOrders, sumCogs } from "@/features/finance/cogs";
import { FinanzasManager } from "@/components/admin/finanzas-manager";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Finanzas · TETSUBURGER Admin",
};

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const today = bogotaToday();
  const monthStart = `${today.slice(0, 8)}01`;

  const from = (typeof params.from === "string" && params.from) || monthStart;
  const to = (typeof params.to === "string" && params.to) || today;

  const supabase = await createClient();

  const [ordersRes, expensesRes, productionRes, closingsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total, subtotal, delivery_fee, delivery_fee_retained, payment_method, origin, created_at")
      .gte("created_at", `${from}T00:00:00-05:00`)
      .lte("created_at", `${to}T23:59:59-05:00`),
    supabase
      .from("expenses")
      .select("id, expense_date, amount, concept, category:expense_categories(name)")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false }),
    supabase
      .from("production_records")
      .select("id, record_date, total_cost")
      .gte("record_date", from)
      .lte("record_date", to),
    supabase
      .from("daily_closings")
      .select("id, closing_date, orders_count, sales_total, expenses_total, estimated_profit, details")
      .gte("closing_date", from)
      .lte("closing_date", to)
      .order("closing_date", { ascending: false }),
  ]);

  const orders = (ordersRes.data ?? []) as {
    id: string; status: string; total: string | number; subtotal: string | number;
    delivery_fee: string | number; delivery_fee_retained: boolean;
    payment_method: string | null; origin: string; created_at: string;
  }[];

  const expenses = ((expensesRes.data ?? []) as unknown as {
    id: string; expense_date: string; amount: string | number; concept: string;
    category?: { name: string }[] | { name: string } | null;
  }[]).map((e) => ({
    ...e,
    category: Array.isArray(e.category) ? e.category[0] ?? null : e.category ?? null,
  }));

  const production = (productionRes.data ?? []) as {
    id: string; record_date: string; total_cost: string | number;
  }[];

  const closings = (closingsRes.data ?? []) as {
    id: string; closing_date: string; orders_count: number;
    sales_total: string | number; expenses_total: string | number;
    estimated_profit: string | number;
    details: Record<string, unknown> | null;
  }[];

  // Costo de lo vendido de los pedidos entregados en el período (misma
  // fórmula que cierre/dashboard): Σ products.cost × cantidad.
  const deliveredIds = orders.filter((o) => o.status === "ENTREGADO").map((o) => o.id);
  const { map: cogsByOrder, missingCostCount } = await getCogsForOrders(deliveredIds);
  const cogsTotal = sumCogs(cogsByOrder);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Finanzas"
        description="Resumen financiero del período · ventas entregadas, costo de lo vendido, gastos y utilidad"
      />

      <FinanzasManager
        orders={orders}
        expenses={expenses}
        production={production}
        closings={closings}
        cogsTotal={cogsTotal}
        missingCostCount={missingCostCount}
        filters={{ from, to }}
      />
    </div>
  );
}
