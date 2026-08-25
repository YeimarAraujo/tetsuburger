import { formatCOP, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { computeOpenStatus } from "@/lib/business-hours";
import { DashboardStats } from "@/components/admin/dashboard-stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard · TETSUBURGER Admin",
};

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const today = bogotaToday();

  const [
    ordersRes,
    expensesRes,
    settingsRes,
    hoursRes,
    todayOrdersRes,
    inventoryRes,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, subtotal, total, delivery_fee, payment_method, origin, created_at")
      .gte("created_at", `${today}T00:00:00-05:00`)
      .lte("created_at", `${today}T23:59:59-05:00`),
    supabase
      .from("expenses")
      .select("id, amount, expense_category_id, category:expense_categories(name)")
      .eq("expense_date", today),
    supabase.from("settings").select("key, value").eq("is_public", true),
    supabase.from("business_hours").select("*"),
    supabase
      .from("orders")
      .select("id, order_number, status, customer_name, total, payment_method, origin, created_at")
      .gte("created_at", `${today}T00:00:00-05:00`)
      .lte("created_at", `${today}T23:59:59-05:00`)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("inventory_items")
      .select("id, name, current_stock, min_stock, unit")
      .eq("is_active", true)
      .order("name"),
  ]);

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  const status = computeOpenStatus(
    hoursRes.data ?? [],
    settings.store_temporarily_closed === true
  );

  const orders = ordersRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const validOrders = orders.filter((o) => o.status !== "CANCELADO");
  const totalSales = validOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalExpenses = expenses.reduce((s, o) => s + Number(o.amount), 0);
  const ordersByStatus = validOrders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const paymentsByMethod = validOrders.reduce(
    (acc, o) => {
      acc[o.payment_method ?? "EFECTIVO"] = (acc[o.payment_method ?? "EFECTIVO"] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const lowStock = (inventoryRes.data ?? []).filter(
    (i) => i.current_stock <= i.min_stock
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">DASHBOARD</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de hoy · {formatDate(`${today}T12:00:00Z`)}
        </p>
      </header>

      <DashboardStats
        status={status}
        today={{
          ordersCount: validOrders.length,
          totalSales,
          totalExpenses,
          profit: totalSales - totalExpenses,
          ordersByStatus,
          paymentsByMethod,
        }}
        recentOrders={todayOrdersRes.data ?? []}
        lowStock={lowStock}
      />
    </div>
  );
}
