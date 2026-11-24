"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  APPEARANCE_THEME_KEY,
  appearanceSettingKey,
  isAppearanceSlot,
  parseImageRef,
  parseThemeSetting,
  type AppearanceSlot,
} from "@/lib/seasonal-theme";

export interface ActionResult {
  error?: string;
}

const BUCKET = "site-assets";
const MAX_SIZE = 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/png", "image/webp", "image/jpeg"];

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireUser(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Comprueba la firma real del archivo (no solo el MIME que declara el cliente). */
function hasImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b);
  }
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/webp") {
    const riff = [0x52, 0x49, 0x46, 0x46].every((b, i) => bytes[i] === b);
    const webp = [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b);
    return riff && webp;
  }
  return false;
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

function revalidateAppearance() {
  revalidatePath("/", "layout");
}

/** Cambia el tema: "auto" (por fecha), "normal" o "navidad". */
export async function saveSiteTheme(theme: string): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Sesión expirada" };

  const value = parseThemeSetting(theme);

  const { error } = await supabase.from("settings").upsert(
    { key: APPEARANCE_THEME_KEY, value, updated_by: user.id },
    { onConflict: "key" }
  );
  if (error) return { error: "No se pudo guardar el tema" };

  revalidateAppearance();
  return {};
}

/**
 * Sube la imagen de un espacio (logo/mascota por tema). Recibe un FormData con
 * `slot`, `file`, `width` y `height` (las medidas las lee el navegador).
 */
export async function uploadAppearanceImage(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Sesión expirada" };

  const slot = formData.get("slot");
  if (!isAppearanceSlot(slot)) return { error: "Espacio de imagen inválido" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Formato no permitido (usa PNG, WebP o JPG)" };
  }
  if (file.size > MAX_SIZE) {
    return { error: "La imagen supera el máximo de 1 MB" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageSignature(bytes, file.type)) {
    return { error: "El archivo no es una imagen válida" };
  }

  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 16 ||
    height < 16 ||
    width > 10000 ||
    height > 10000
  ) {
    return { error: "No se pudieron leer las medidas de la imagen" };
  }

  // Imagen anterior de este espacio, para limpiarla después de reemplazarla
  const key = appearanceSettingKey(slot as AppearanceSlot);
  const { data: previous } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${slot}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "No se pudo subir la imagen" };

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("settings").upsert(
    {
      key,
      value: { url: pub.publicUrl, width, height },
      updated_by: user.id,
    },
    { onConflict: "key" }
  );
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "No se pudo guardar la imagen" };
  }

  const old = parseImageRef(previous?.value);
  const oldPath = old ? storagePathFromUrl(old.src) : null;
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);

  revalidateAppearance();
  return {};
}

/** Quita la imagen subida de un espacio y vuelve al archivo por defecto. */
export async function resetAppearanceImage(
  slot: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Sesión expirada" };
  if (!isAppearanceSlot(slot)) return { error: "Espacio de imagen inválido" };

  const key = appearanceSettingKey(slot);
  const { data: previous } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  const { error } = await supabase.from("settings").delete().eq("key", key);
  if (error) return { error: "No se pudo restaurar la imagen" };

  const old = parseImageRef(previous?.value);
  const oldPath = old ? storagePathFromUrl(old.src) : null;
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);

  revalidateAppearance();
  return {};
}
