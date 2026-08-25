"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/categories/actions";

const hourSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  opens_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora de apertura inválida"),
  closes_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora de cierre inválida"),
  is_active: z.boolean(),
});

export async function updateBusinessHour(input: {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}): Promise<ActionResult> {
  const parsed = hourSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { error } = await supabase
    .from("business_hours")
    .update(parsed.data)
    .eq("day_of_week", parsed.data.day_of_week);

  if (error) return { error: "No se pudo guardar el horario" };

  revalidatePath("/admin/horarios");
  revalidatePath("/");
  return {};
}
