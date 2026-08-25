"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  addonSchema,
  productSchema,
} from "@/features/products/schema";

export interface ActionResult {
  error?: string;
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parseProductForm(formData: FormData): ParseResult<z.infer<typeof productSchema>> {
  const raw = {
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    is_active: formData.get("is_active") === "on",
    is_available: formData.get("is_available") === "on",
    is_featured: formData.get("is_featured") === "on",
  };
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}

function parseAddonIds(formData: FormData): string[] {
  const ids = formData.getAll("addon_ids").map(String).filter(Boolean);
  // Sanitización: solo UUIDs válidos
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return ids.filter((id) => uuidRe.test(id));
}

/** Valida y sube la imagen a Storage; devuelve su URL pública o null */
async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File | null
): Promise<{ url?: string; error?: string }> {
  if (!file || file.size === 0) return {};

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Formato de imagen no permitido (usa JPG, PNG o WebP)" };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: "La imagen supera el máximo de 3 MB" };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: "No se pudo subir la imagen" };

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { url: data.publicUrl };
}

async function deleteImage(supabase: Awaited<ReturnType<typeof createClient>>, url: string) {
  const marker = "/object/public/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  await supabase.storage.from("product-images").remove([path]);
}

/* ---------------------------------- Productos --------------------------------- */

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const image = await uploadImage(supabase, formData.get("image_file") as File | null);
  if (image.error) return { error: image.error };

  let slug = slugify(parsed.data.name);

  // Slug único
  for (let i = 2; ; i++) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .limit(1);
    if (!existing || existing.length === 0) break;
    slug = `${slugify(parsed.data.name)}-${i}`;
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      category_id: parsed.data.category_id,
      description: parsed.data.description,
      price: parsed.data.price,
      is_active: parsed.data.is_active,
      is_available: parsed.data.is_available,
      is_featured: parsed.data.is_featured,
      image_url: image.url ?? "",
      slug,
    })
    .select("id")
    .single();

  if (error || !created) return { error: "No se pudo crear el producto" };

  const addonIds = parseAddonIds(formData);
  if (addonIds.length > 0) {
    await supabase
      .from("product_addons")
      .insert(addonIds.map((addon_id) => ({ product_id: created.id, addon_id })));
  }

  revalidatePath("/admin/productos");
  revalidatePath("/");
  return {};
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", id)
    .single();

  const image = await uploadImage(supabase, formData.get("image_file") as File | null);
  if (image.error) return { error: image.error };

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.category_id,
      description: parsed.data.description,
      price: parsed.data.price,
      is_active: parsed.data.is_active,
      is_available: parsed.data.is_available,
      is_featured: parsed.data.is_featured,
      ...(image.url ? { image_url: image.url } : {}),
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el producto" };

  // Reemplaza la asociación de adicionales
  await supabase.from("product_addons").delete().eq("product_id", id);
  const addonIds = parseAddonIds(formData);
  if (addonIds.length > 0) {
    await supabase
      .from("product_addons")
      .insert(addonIds.map((addon_id) => ({ product_id: id, addon_id })));
  }

  // Limpieza best-effort de la imagen anterior si se reemplazó
  if (image.url && current?.image_url && current.image_url !== image.url) {
    await deleteImage(supabase, current.image_url);
  }

  revalidatePath("/admin/productos");
  revalidatePath("/");
  return {};
}

async function toggleColumn(id: string, column: "is_active" | "is_available" | "is_featured", value: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ [column]: value }).eq("id", id);
  if (error) return { error: "No se pudo actualizar el producto" };
  revalidatePath("/admin/productos");
  revalidatePath("/");
  return {};
}

export async function setProductActive(id: string, value: boolean): Promise<ActionResult> {
  return toggleColumn(id, "is_active", value);
}

export async function setProductAvailable(id: string, value: boolean): Promise<ActionResult> {
  return toggleColumn(id, "is_available", value);
}

export async function setProductFeatured(id: string, value: boolean): Promise<ActionResult> {
  return toggleColumn(id, "is_featured", value);
}

/* ---------------------------------- Adicionales -------------------------------- */

function parseAddonForm(formData: FormData): ParseResult<z.infer<typeof addonSchema>> {
  const raw = {
    name: formData.get("name"),
    price: formData.get("price"),
    is_active: formData.get("is_active") === "on",
  };
  const parsed = addonSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}

export async function createAddon(formData: FormData): Promise<ActionResult> {
  const parsed = parseAddonForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("addons").insert(parsed.data);

  if (error) return { error: "No se pudo crear el adicional" };

  revalidatePath("/admin/adicionales");
  revalidatePath("/admin/productos");
  return {};
}

export async function updateAddon(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseAddonForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("addons").update(parsed.data).eq("id", id);

  if (error) return { error: "No se pudo actualizar el adicional" };

  revalidatePath("/admin/adicionales");
  revalidatePath("/admin/productos");
  return {};
}

export async function setAddonActive(id: string, value: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("addons").update({ is_active: value }).eq("id", id);
  if (error) return { error: "No se pudo cambiar el estado" };
  revalidatePath("/admin/adicionales");
  return {};
}
