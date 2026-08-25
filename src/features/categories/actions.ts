"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import {
  categorySchema,
  type CategoryInput,
} from "@/features/categories/schema";

export interface ActionResult {
  error?: string;
}

async function getUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const supabase = await createClient();
  const root = slugify(base);
  let slug = root;
  let i = 2;

  for (;;) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (!data || data.length === 0 || (excludeId && data[0].id === excludeId)) {
      return slug;
    }
    slug = `${root}-${i++}`;
  }
}

type ParseResult =
  | { ok: true; data: CategoryInput }
  | { ok: false; error: string };

function parseInput(input: unknown): ParseResult {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  return { ok: true, data: parsed.data };
}

export async function createCategory(
  input: CategoryInput
): Promise<ActionResult> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const data = parsed.data;
  const supabase = await createClient();
  const slug = await getUniqueSlug(data.name);

  const { error } = await supabase.from("categories").insert({
    name: data.name,
    description: data.description,
    image_url: data.image_url,
    display_order: data.display_order,
    is_active: data.is_active,
    slug,
  });

  if (error) return { error: "No se pudo crear la categoría" };

  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return {};
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<ActionResult> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const data = parsed.data;
  const supabase = await createClient();
  const slug = await getUniqueSlug(data.name, id);

  const { error } = await supabase
    .from("categories")
    .update({
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      display_order: data.display_order,
      is_active: data.is_active,
      slug,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar la categoría" };

  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return {};
}

export async function setCategoryActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: "No se pudo cambiar el estado" };

  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return {};
}

/** Intercambia el orden con la categoría vecina en la lista ordenada */
export async function moveCategory(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: all, error: fetchError } = await supabase
    .from("categories")
    .select("id, display_order")
    .order("display_order")
    .order("name");

  if (fetchError || !all) return { error: "No se pudo leer el orden" };

  const index = all.findIndex((c) => c.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || targetIndex < 0 || targetIndex >= all.length) {
    return {};
  }

  const current = all[index];
  const target = all[targetIndex];

  // Evita colisión de valores intermedios actualizando a valores temporales
  await supabase
    .from("categories")
    .update({ display_order: -1 })
    .eq("id", current.id);

  const { error: err1 } = await supabase
    .from("categories")
    .update({ display_order: current.display_order })
    .eq("id", target.id);

  const { error: err2 } = await supabase
    .from("categories")
    .update({ display_order: target.display_order })
    .eq("id", current.id);

  if (err1 || err2) return { error: "No se pudo reordenar" };

  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return {};
}
