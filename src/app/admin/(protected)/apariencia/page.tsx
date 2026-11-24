import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { AppearanceManager } from "@/components/admin/appearance/appearance-manager";
import {
  APPEARANCE_SLOTS,
  APPEARANCE_THEME_KEY,
  appearanceSettingKey,
  parseImageRef,
  parseThemeSetting,
  resolveSiteTheme,
  type AppearanceSlot,
  type ImageRef,
} from "@/lib/seasonal-theme";

export const metadata = {
  title: "Apariencia · TETSU BURGER Admin",
};

export default async function AppearancePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      APPEARANCE_THEME_KEY,
      ...APPEARANCE_SLOTS.map(appearanceSettingKey),
    ]);

  const values = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));

  const themeSetting = parseThemeSetting(values[APPEARANCE_THEME_KEY]);
  const uploaded = Object.fromEntries(
    APPEARANCE_SLOTS.map((slot) => [
      slot,
      parseImageRef(values[appearanceSettingKey(slot)]),
    ])
  ) as Record<AppearanceSlot, ImageRef | null>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Apariencia"
        description="Tema del sitio, logos y mascota · se aplican en la página pública en unos minutos"
      />

      <AppearanceManager
        themeSetting={themeSetting}
        activeTheme={resolveSiteTheme(themeSetting)}
        uploaded={uploaded}
      />
    </div>
  );
}
