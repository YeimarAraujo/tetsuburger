"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/categories/actions";

interface SettingsPayload {
  texts: Record<string, string>;
  flags: Record<string, boolean>;
}

function sanitize(payload: SettingsPayload): ActionResult & {
  clean?: SettingsPayload;
} {
  const clean: SettingsPayload = { texts: {}, flags: {} };
  const allowedTexts = new Set([
    "whatsapp_number",
    "delivery_fee",
    "delivery_fee_business",
    "min_order_total",
    "banner_text",
    "hero_image",
    "closed_message",
    "address",
    "instagram_url",
    "facebook_url",
  ]);
  const allowedFlags = new Set([
    "store_temporarily_closed",
    "allow_orders_outside_hours",
  ]);

  for (const [key, raw] of Object.entries(payload.texts ?? {})) {
    if (!allowedTexts.has(key)) continue;
    let value = String(raw).trim().slice(0, 500);

    if (key === "whatsapp_number") {
      const digits = value.replace(/[^0-9]/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return { error: "El número de WhatsApp debe incluir indicativo de país (ej: 573044243650)" };
      }
      value = digits;
    }

    if (key === "delivery_fee" || key === "delivery_fee_business" || key === "min_order_total") {
      const num = Number(value || "0");
      if (Number.isNaN(num) || num < 0) return { error: `${key}: valor numérico inválido` };
      value = String(num);
    }

    clean.texts[key] = value;
  }

  for (const [key, value] of Object.entries(payload.flags ?? {})) {
    if (allowedFlags.has(key)) clean.flags[key] = Boolean(value);
  }

  return { clean };
}

export async function saveSettings(payload: SettingsPayload): Promise<ActionResult> {
  const result = sanitize(payload);
  if (result.error) return { error: result.error };
  const clean = result.clean!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión expirada" };

  const rows = [
    ...Object.entries(clean.texts).map(([key, value]) => ({
      key,
      // Los montos se guardan como número JSON; el resto como texto
      value: ["delivery_fee", "delivery_fee_business", "min_order_total"].includes(key)
        ? Number(value)
        : value,
      updated_by: user.id,
    })),
    ...Object.entries(clean.flags).map(([key, value]) => ({
      key,
      value,
      updated_by: user.id,
    })),
  ];

  const { error } = await supabase
    .from("settings")
    .upsert(rows, { onConflict: "key" });

  if (error) return { error: "No se pudo guardar la configuración" };

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
  revalidatePath("/checkout");
  return {};
}
