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

  const [ordersRes, expensesRes, categoriesRes, settingsRes] = await Promise.all([
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

  const deliveryFeeBusiness = Number(
    (settingsRes.data ?? []).find((r) => r.key === "delivery_fee_business")?.value ?? 0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">REPORTES</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de ventas, gastos y utilidad por período
        </p>
      </header>

      <ReportsManager
        orders={(ordersRes.data as unknown as any[]) ?? []}
        expenses={expenses}
        categories={(categoriesRes.data ?? []) as any[]}
        filters={{ from, to, category }}
        deliveryFeeBusiness={deliveryFeeBusiness}
      />
    </div>
  );
}
