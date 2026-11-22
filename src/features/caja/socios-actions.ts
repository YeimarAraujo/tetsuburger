"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  socioMovimientoSchema,
  socioSchema,
} from "@/features/caja/socios-schema";

export interface ActionResult {
  error?: string;
}

async function assertAuth(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? null : "No autorizado";
}

function revalidate() {
  revalidatePath("/admin/caja");
  revalidatePath("/admin");
}

export async function createSocio(input: unknown): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  const parsed = socioSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("caja_socios")
    .insert({ nombre: parsed.data.nombre });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un socio con ese nombre"
          : "No se pudo crear el socio",
    };
  }

  revalidate();
  return {};
}

/**
 * Registra un préstamo (sale plata de una base) o un abono (entra plata a una
 * base) de un socio. Crea primero el movimiento de caja y luego el del socio
 * ligado a él; si el segundo falla, se deshace el primero.
 */
export async function createSocioMovimiento(input: unknown): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  const parsed = socioMovimientoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();

  const { data: socio } = await supabase
    .from("caja_socios")
    .select("id, nombre")
    .eq("id", data.socio_id)
    .maybeSingle();
  if (!socio) return { error: "El socio no existe" };

  if (data.tipo === "ABONO") {
    const { data: movs } = await supabase
      .from("caja_socio_movimientos")
      .select("tipo, amount")
      .eq("socio_id", data.socio_id);
    const deuda = (movs ?? []).reduce(
      (s, m) => s + (m.tipo === "PRESTAMO" ? 1 : -1) * Number(m.amount),
      0
    );
    if (data.amount > deuda) {
      return { error: "El abono es mayor que lo que debe el socio" };
    }
  }

  const esPrestamo = data.tipo === "PRESTAMO";
  const nota = data.description ? ` · ${data.description}` : "";

  const { data: cajaRow, error: cajaError } = await supabase
    .from("caja_movements")
    .insert({
      movement_date: data.movement_date,
      tipo: esPrestamo ? "RETIRO" : "INGRESO_EXTRA",
      bolsillo: data.bolsillo,
      metodo: data.metodo,
      amount: esPrestamo ? -data.amount : data.amount,
      description: `${esPrestamo ? "Préstamo a" : "Abono de"} ${socio.nombre}${nota}`,
      fuente: esPrestamo ? "Préstamo a socio" : "Abono de socio",
      ref_type: "socio",
      ref_id: data.socio_id,
    })
    .select("id")
    .single();

  if (cajaError || !cajaRow) return { error: "No se pudo registrar el movimiento en la caja" };

  const { error } = await supabase.from("caja_socio_movimientos").insert({
    socio_id: data.socio_id,
    tipo: data.tipo,
    movement_date: data.movement_date,
    amount: data.amount,
    metodo: data.metodo,
    bolsillo: data.bolsillo,
    description: data.description,
    caja_movement_id: cajaRow.id,
  });

  if (error) {
    await supabase.from("caja_movements").delete().eq("id", cajaRow.id);
    return { error: "No se pudo registrar el movimiento del socio" };
  }

  revalidate();
  return {};
}

/**
 * Elimina un préstamo o abono. Borra también su movimiento de caja (que arrastra
 * al del socio por la FK en cascada), así el saldo de la base se corrige.
 */
export async function deleteSocioMovimiento(id: string): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  if (!z.string().uuid().safeParse(id).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("caja_socio_movimientos")
    .select("caja_movement_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return {};

  const { error } = existing.caja_movement_id
    ? await supabase.from("caja_movements").delete().eq("id", existing.caja_movement_id)
    : await supabase.from("caja_socio_movimientos").delete().eq("id", id);

  if (error) return { error: "No se pudo eliminar el movimiento" };

  revalidate();
  return {};
}

/** Elimina un socio solo si no tiene movimientos registrados. */
export async function deleteSocio(id: string): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  if (!z.string().uuid().safeParse(id).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("caja_socio_movimientos")
    .select("id", { count: "exact", head: true })
    .eq("socio_id", id);

  if ((count ?? 0) > 0) {
    return { error: "El socio tiene movimientos; elimínalos primero" };
  }

  const { error } = await supabase.from("caja_socios").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el socio" };

  revalidate();
  return {};
}
