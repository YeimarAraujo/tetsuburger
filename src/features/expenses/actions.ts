"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import type { CajaMetodo } from "@/types/db";
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

/** Crea/actualiza el movimiento de caja ligado a un gasto marcado "sale de caja". */
async function syncExpenseMovement(
  supabase: SupabaseClient,
  expenseId: string,
  data: ExpenseInput,
  metodo: CajaMetodo
): Promise<void> {
  const { data: existing } = await supabase
    .from("caja_movements")
    .select("id")
    .eq("ref_type", "expense")
    .eq("ref_id", expenseId)
    .maybeSingle();

  const wants = data.from_caja && data.amount > 0;

  if (wants && existing) {
    await supabase
      .from("caja_movements")
      .update({
        movement_date: data.expense_date,
        amount: -data.amount,
        description: data.concept,
        metodo,
      })
      .eq("id", existing.id);
  } else if (wants && !existing) {
    await supabase.from("caja_movements").insert({
      movement_date: data.expense_date,
      tipo: "GASTO",
      metodo,
      amount: -data.amount,
      description: data.concept,
      fuente: `Gasto: ${data.concept}`,
      ref_type: "expense",
      ref_id: expenseId,
    });
  } else if (!wants && existing) {
    await supabase.from("caja_movements").delete().eq("id", existing.id);
  }
}

/**
 * Nota de diseño: los gastos NO se eliminan nunca (integridad histórica y
 * financiera). Los errores se corrigen editando el registro; el trigger de
 * auditoría deja rastro del valor anterior automáticamente. El movimiento de
 * caja asociado se sincroniza si el gasto sale (o dejó de salir) de la caja.
 */
export async function createExpense(input: unknown): Promise<ActionResult & { id?: string }> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const { metodo, ...expenseData } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert(expenseData)
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo registrar el gasto" };

  await syncExpenseMovement(supabase, data.id, parsed.data, metodo);

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  return { id: data.id };
}

export async function updateExpense(id: string, input: unknown): Promise<ActionResult> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const { metodo, ...expenseData } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .update(expenseData)
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el gasto" };

  await syncExpenseMovement(supabase, id, parsed.data, metodo);

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  return {};
}