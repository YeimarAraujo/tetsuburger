"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  cajaManualMovementSchema,
  cajaTransferSchema,
} from "@/features/caja/schema";
import { BOLSILLO_LABEL } from "@/lib/caja-bolsillos";
import type { CajaBolsillo } from "@/types/db";

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
      bolsillo: data.bolsillo,
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
 * Traslada plata de una base a la otra (mismo medio). Se guardan dos filas
 * ligadas por ref_id: sale de una base y entra a la otra, en una sola
 * inserción (o se guardan las dos o ninguna).
 */
export async function createCajaTransfer(input: unknown): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  const parsed = cajaTransferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const hacia: CajaBolsillo = data.desde === "COMPRAS" ? "GANANCIA" : "COMPRAS";
  const refId = crypto.randomUUID();
  const nota = data.description ? ` · ${data.description}` : "";
  const common = {
    movement_date: data.movement_date,
    tipo: "TRASLADO" as const,
    metodo: data.metodo,
    fuente: "Traslado entre bases",
    ref_type: "traslado",
    ref_id: refId,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("caja_movements").insert([
    {
      ...common,
      bolsillo: data.desde,
      amount: -data.amount,
      description: `Traslado a ${BOLSILLO_LABEL[hacia]}${nota}`,
    },
    {
      ...common,
      bolsillo: hacia,
      amount: data.amount,
      description: `Traslado desde ${BOLSILLO_LABEL[data.desde]}${nota}`,
    },
  ]);

  if (error) return { error: "No se pudo registrar el traslado" };

  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  return {};
}

/**
 * Elimina un movimiento manual (ingreso extra, retiro, ajuste o traslado). Los
 * movimientos automáticos (venta, compra, gasto) no se pueden borrar desde
 * aquí: se corrigen en su origen. Un traslado se elimina completo (sus dos
 * filas).
 */
export async function deleteCajaMovement(id: string): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  if (!z.string().uuid().safeParse(id).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("caja_movements")
    .select("tipo, ref_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return {};

  if (!["INGRESO_EXTRA", "RETIRO", "AJUSTE", "TRASLADO"].includes(existing.tipo)) {
    return { error: "Este movimiento lo genera el sistema y no se puede eliminar" };
  }

  const query = supabase.from("caja_movements").delete();
  const { error } =
    existing.tipo === "TRASLADO" && existing.ref_id
      ? await query.eq("ref_type", "traslado").eq("ref_id", existing.ref_id)
      : await query.eq("id", id);

  if (error) return { error: "No se pudo eliminar el movimiento" };

  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  return {};
}
