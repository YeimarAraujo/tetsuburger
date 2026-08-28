import { createClient } from "@/lib/supabase/server";
import { ReportsManager } from "@/components/admin/reports-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reportes · TETSUBURGER Admin",
};

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const today = bogotaToday();
  const monthStart = `${today.slice(0, 8)}01`;

  const from = (typeof params.from === "string" && params.from) || monthStart;
  const to = (typeof params.to === "string" && params.to) || today;
  const category = typeof params.cat === "string" && params.cat ? params.cat : "todas";

  const supabase = await createClient();

  let expensesQuery = supabase
    .from("expenses")
    .select("id, expense_date, concept, amount, category:expense_categories(name)")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false });

  if (category !== "todas") {
    expensesQuery = expensesQuery.eq("expense_category_id", Number(category));
  }

  const [ordersRes, expensesRes, categoriesRes, productionRes, settingsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, customer_name, total, subtotal, delivery_fee, delivery_fee_retained, payment_method, origin, created_at")
      .gte("created_at", `${from}T00:00:00-05:00`)
      .lte("created_at", `${to}T23:59:59-05:00`)
      .order("created_at", { ascending: false }),
    expensesQuery,
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("production_records")
      .select("id, record_date, description, quantity, unit, unit_cost, total_cost, item:inventory_items(name)")
      .gte("record_date", from)
      .lte("record_date", to)
      .order("record_date", { ascending: false }),
    supabase
      .from("settings")
      .select("key, value")
      .eq("key", "delivery_fee_business"),
  ]);

  const expenses = ((expensesRes.data ?? []) as unknown as {
    id: string;
    expense_date: string;
    concept: string;
    amount: string | number;
    category?: { name: string } | null;
  }[]).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    concept: e.concept,
    amount: Number(e.amount),
    category_name: (e.category as unknown as { name?: string } | null)?.name ?? null,
  }));

  const production = ((productionRes.data ?? []) as unknown as {
    id: string;
    record_date: string;
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number | string;
    total_cost: number | string;
    item?: { name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    record_date: r.record_date,
    description: r.description,
    quantity: Number(r.quantity),
    unit: r.unit,
    unit_cost: Number(r.unit_cost),
    total_cost: Number(r.total_cost),
    item: r.item && !Array.isArray(r.item) ? r.item : null,
  }));

  const orders = ((ordersRes.data ?? []) as unknown as {
    id: string;
    order_number: number;
    status: string;
    customer_name: string;
    total: number | string;
    subtotal: number | string;
    delivery_fee: number | string;
    delivery_fee_retained: boolean;
    payment_method: string | null;
    origin: string;
    created_at: string;
  }[]).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    customer_name: o.customer_name,
    total: Number(o.total),
    subtotal: Number(o.subtotal),
    delivery_fee: Number(o.delivery_fee),
    delivery_fee_retained: o.delivery_fee_retained,
    payment_method: o.payment_method,
    origin: o.origin,
    created_at: o.created_at,
  }));

  const categories = ((categoriesRes.data ?? []) as unknown as {
    id: number;
    name: string;
  }[]).map((c) => ({ id: c.id, name: c.name }));

  const deliveryFeeBusiness = Number(
    (settingsRes.data ?? []).find((r) => r.key === "delivery_fee_business")?.value ?? 0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">REPORTES</h1>
        <p className="text-sm text-muted-foreground">
          Historiales de pedidos, gastos y compras por período
        </p>
      </header>

      <ReportsManager
        orders={orders}
        expenses={expenses}
        production={production}
        categories={categories}
        filters={{ from, to, category }}
        deliveryFeeBusiness={deliveryFeeBusiness}
      />
    </div>
  );
}
