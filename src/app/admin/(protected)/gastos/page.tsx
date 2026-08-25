import { createClient } from "@/lib/supabase/server";
import { ExpenseManager, type ExpenseRow } from "@/components/admin/expenses/expense-manager";

export const metadata = {
  title: "Gastos · TETSUBURGER Admin",
};

export const dynamic = "force-dynamic";

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const today = bogotaToday();
  const monthStart = `${today.slice(0, 8)}01`;

  const from = (typeof params.from === "string" && params.from) || monthStart;
  const to = (typeof params.to === "string" && params.to) || today;
  const category =
    typeof params.cat === "string" && params.cat ? params.cat : "todas";

  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select("id, expense_date, expense_category_id, concept, amount, description, category:expense_categories(name)")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (category !== "todas") {
    query = query.eq("expense_category_id", Number(category));
  }

  const [expensesRes, categoriesRes] = await Promise.all([
    query,
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const rows: ExpenseRow[] = ((expensesRes.data ?? []) as unknown as {
    id: string;
    expense_date: string;
    expense_category_id: number;
    concept: string;
    amount: string | number;
    description: string;
    category?: { name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    expense_date: r.expense_date,
    expense_category_id: r.expense_category_id,
    concept: r.concept,
    amount: Number(r.amount),
    description: r.description,
    category_name: r.category?.name ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-bold">Gastos</h1>
        <p className="text-sm text-muted-foreground">
          Control de egresos del negocio · alimenta el cierre diario y las
          finanzas
        </p>
      </header>

      <ExpenseManager
        rows={rows}
        categories={categoriesRes.data ?? []}
        filters={{ from, to, category }}
      />
    </div>
  );
}
