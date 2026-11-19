"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkStaff } from "@/features/auth/guard";
import type { ActionResult } from "@/features/categories/actions";

const ruleSchema = z.object({
  name: z.string().trim().max(60, "El nombre es muy largo (máx. 60)"),
  min_total: z
    .number({ message: "Escribe un monto válido" })
    .int("El monto debe ser un número entero")
    .min(1000, "El monto mínimo debe ser al menos $1.000")
    .max(10_000_000, "El monto es demasiado alto"),
  free_delivery: z.boolean(),
  is_active: z.boolean(),
});

export type PromotionRuleInput = z.input<typeof ruleSchema>;

const idSchema = z.string().uuid("ID inválido");

/** Las promociones se ven en el inicio, el resumen y el checkout. */
function revalidatePromotionPaths() {
  revalidatePath("/admin/promociones");
  revalidatePath("/");
  revalidatePath("/resumen");
  revalidatePath("/checkout");
}

/** Crea (id = null) o actualiza una regla de promoción. */
export async function savePromotionRule(
  id: string | null,
  input: PromotionRuleInput
): Promise<ActionResult> {
  const guard = await checkStaff(true);
  if (!guard.ok) return { error: guard.error };

  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  if (id === null) {
    const { error } = await supabase.from("promotion_rules").insert(parsed.data);
    if (error) return { error: "No se pudo crear la regla" };
  } else {
    if (!idSchema.safeParse(id).success) return { error: "ID inválido" };
    const { error } = await supabase
      .from("promotion_rules")
      .update(parsed.data)
      .eq("id", id);
    if (error) return { error: "No se pudo guardar la regla" };
  }

  revalidatePromotionPaths();
  return {};
}

/** Elimina una regla junto con su lista de regalos. */
export async function deletePromotionRule(id: string): Promise<ActionResult> {
  const guard = await checkStaff(true);
  if (!guard.ok) return { error: guard.error };
  if (!idSchema.safeParse(id).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("promotion_rules").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la regla" };

  revalidatePromotionPaths();
  return {};
}

/** Agrega un producto a la lista de regalos posibles de una regla. */
export async function addPromotionGift(
  ruleId: string,
  productId: string
): Promise<ActionResult> {
  const guard = await checkStaff(true);
  if (!guard.ok) return { error: guard.error };
  if (!idSchema.safeParse(ruleId).success || !idSchema.safeParse(productId).success) {
    return { error: "ID inválido" };
  }

  const supabase = await createClient();

  // El domicilio gratis es una regla aparte: no lleva regalos.
  const { data: rule } = await supabase
    .from("promotion_rules")
    .select("free_delivery")
    .eq("id", ruleId)
    .maybeSingle();
  if (rule?.free_delivery) {
    return {
      error:
        "Las reglas de domicilio gratis no llevan regalos. Crea una regla de regalo aparte.",
    };
  }

  const { error } = await supabase
    .from("promotion_rule_gifts")
    .insert({ rule_id: ruleId, product_id: productId });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ese producto ya es un regalo de esta regla"
          : "No se pudo agregar el regalo",
    };
  }

  revalidatePromotionPaths();
  return {};
}

/** Activa o pausa un regalo sin quitarlo de la lista. */
export async function setPromotionGiftActive(
  giftId: string,
  isActive: boolean
): Promise<ActionResult> {
  const guard = await checkStaff(true);
  if (!guard.ok) return { error: guard.error };
  if (!idSchema.safeParse(giftId).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_rule_gifts")
    .update({ is_active: isActive })
    .eq("id", giftId);

  if (error) return { error: "No se pudo actualizar el regalo" };

  revalidatePromotionPaths();
  return {};
}

/** Quita un regalo de la lista de una regla. */
export async function removePromotionGift(giftId: string): Promise<ActionResult> {
  const guard = await checkStaff(true);
  if (!guard.ok) return { error: guard.error };
  if (!idSchema.safeParse(giftId).success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_rule_gifts")
    .delete()
    .eq("id", giftId);

  if (error) return { error: "No se pudo quitar el regalo" };

  revalidatePromotionPaths();
  return {};
}
