"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  expenseSchema,
  type ExpenseInput,
} from "@/features/expenses/schema";

export interface ActionResult {
  error?: string;
}

function parseInput(input: unknown): { ok: true; data: ExpenseInput } | { ok: false; error: string } {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}

/**
 * Nota de diseño: los gastos NO se eliminan nunca (integridad histórica y
 * financiera). Los errores se corrigen editando el registro; el trigger de
 * auditoría deja rastro del valor anterior automáticamente.
 */
export async function createExpense(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const { error } = await supabase.from("expenses").insert(parsed.data);

  if (error) return { error: "No se pudo registrar el gasto" };

  revalidatePath("/admin/gastos");
  revalidatePath("/admin");
  return {};
}

export async function updateExpense(id: string, input: unknown): Promise<ActionResult> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el gasto" };

  revalidatePath("/admin/gastos");
  revalidatePath("/admin");
  return {};
}
