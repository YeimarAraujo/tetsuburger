"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  cajaManualMovementSchema,
} from "@/features/caja/schema";

export interface ActionResult {
  error?: string;
}

const MANUAL_LABEL: Record<string, string> = {
  INGRESO_EXTRA: "Ingreso adicional",
  RETIRO: "Retiro",
  AJUSTE: "Ajuste de caja",
};

async function assertAuth(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? null : "No autorizado";
}

/**
 * Registra un movimiento manual de caja. El signo se deriva del tipo:
 * INGRESO_EXTRA (+) y RETIRO (−) por convención; AJUSTE usa es_ingreso como
 * signo (sobrante + / faltante −).
 */
export async function createCajaMovement(
  input: unknown
): Promise<ActionResult & { id?: string }> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  const parsed = cajaManualMovementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const sign =
    data.tipo === "INGRESO_EXTRA"
      ? 1
      : data.tipo === "RETIRO"
        ? -1
        : data.es_ingreso
          ? 1
          : -1;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("caja_movements")
    .insert({
      movement_date: data.movement_date,
      tipo: data.tipo,
      // El ajuste del arqueo siempre es efectivo físico (nace de la caja contada).
      metodo: data.tipo === "AJUSTE" ? "EFECTIVO" : data.metodo,
      amount: sign * data.amount,
      description: data.description,
      fuente: MANUAL_LABEL[data.tipo],
    })
    .select("id")
    .single();

  if (error || !row) return { error: "No se pudo registrar el movimiento" };

  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  return { id: row.id };
}

/**
 * Elimina un movimiento manual (ingreso extra, retiro o ajuste). Los
 * movimientos automáticos (venta en efectivo, compra, gasto) no se pueden
 * borrar desde aquí: se corrigen en su origen.
 */
export async function deleteCajaMovement(id: string): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  if (!z.string().uuid().safeParse(id).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("caja_movements")
    .select("tipo")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return {};

  if (!["INGRESO_EXTRA", "RETIRO", "AJUSTE"].includes(existing.tipo)) {
    return { error: "Este movimiento lo genera el sistema y no se puede eliminar" };
  }

  const { error } = await supabase
    .from("caja_movements")
    .delete()
    .eq("id", id);

  if (error) return { error: "No se pudo eliminar el movimiento" };

  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  return {};
}