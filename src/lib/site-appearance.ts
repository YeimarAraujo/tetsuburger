import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import {
  APPEARANCE_SLOTS,
  APPEARANCE_THEME_KEY,
  appearanceSettingKey,
  buildSiteAppearance,
  type SiteAppearance,
} from "@/lib/seasonal-theme";

const KEYS = [
  APPEARANCE_THEME_KEY,
  ...APPEARANCE_SLOTS.map(appearanceSettingKey),
];

/**
 * Apariencia vigente (tema + logos + mascota). Si la base no responde, cae a
 * los valores por defecto para que el sitio nunca se quede sin imágenes.
 * `cache` evita repetir la consulta dentro de una misma petición.
 */
export const getSiteAppearance = cache(async (): Promise<SiteAppearance> => {
  try {
    const { data, error } = await createPublicClient()
      .from("settings")
      .select("key, value")
      .in("key", KEYS);
    if (error) return buildSiteAppearance({});
    return buildSiteAppearance(
      Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    );
  } catch {
    return buildSiteAppearance({});
  }
});
