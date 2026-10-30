import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExpenseWithCategory {
  id: string;
  expense_date: string;
  amount: number;
  concept: string;
  expense_category_id: number | null;
  category: { name: string } | null;
  /** La categoría ya está dentro del costo de cada producto (p. ej. Empaques). */
  includedInProductCost: boolean;
}

interface RawExpense {
  id: string;
  expense_date: string;
  amount: number | string;
  concept: string;
  expense_category_id: number | null;
  category?:
    | { name: string; included_in_product_cost?: boolean }
    | { name: string; included_in_product_cost?: boolean }[]
    | null;
}

/**
 * Gastos del período con su categoría. Si la migración 0033 no está aplicada
 * (sin included_in_product_cost), todas las categorías cuentan como gasto.
 */
export async function fetchExpenses(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<ExpenseWithCategory[]> {
  const query = (category: string) =>
    supabase
      .from("expenses")
      .select(`id, expense_date, amount, concept, expense_category_id, category:expense_categories(${category})`)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false });

  const withFlag = await query("name, included_in_product_cost");
  const rows = withFlag.error ? (await query("name")).data : withFlag.data;

  return ((rows ?? []) as unknown as RawExpense[]).map((e) => {
    const cat = Array.isArray(e.category) ? e.category[0] ?? null : e.category ?? null;
    return {
      id: e.id,
      expense_date: e.expense_date,
      amount: Number(e.amount) || 0,
      concept: e.concept,
      expense_category_id: e.expense_category_id,
      category: cat ? { name: cat.name } : null,
      includedInProductCost: cat?.included_in_product_cost === true,
    };
  });
}
