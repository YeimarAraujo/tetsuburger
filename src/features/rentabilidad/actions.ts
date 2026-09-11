"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/categories/actions";
import {
  DEFAULT_CONFIG,
  SETTINGS_KEY,
  sanitizeConfig,
  type BusinessConfig,
} from "@/features/rentabilidad/config";

/** Lee los costos del negocio desde settings (compartidos entre todo el staff). */
export async function getBusinessCosts(): Promise<BusinessConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (!data?.value || typeof data.value !== "object") return DEFAULT_CONFIG;
  return sanitizeConfig(data.value as Partial<BusinessConfig>);
}

/** Persiste los costos del negocio en settings (reemplaza el antiguo localStorage). */
export async function saveBusinessCosts(input: Partial<BusinessConfig>): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada" };

  const { error } = await supabase.from("settings").upsert(
    {
      key: SETTINGS_KEY,
      value: sanitizeConfig(input),
      is_public: false,
      updated_by: user.id,
    },
    { onConflict: "key" }
  );

  if (error) return { error: "No se pudo guardar la configuración" };

  return {};
}