import { createClient } from "@/lib/supabase/server";
import { computeOpenStatus } from "@/lib/business-hours";
import { HoursManager } from "@/components/admin/hours/hours-manager";

export const metadata = {
  title: "Horarios · TETSUBURGER Admin",
};

export default async function HoursPage() {
  const supabase = await createClient();

  const [hoursRes, settingsRes] = await Promise.all([
    supabase.from("business_hours").select("*").order("day_of_week"),
    supabase.from("settings").select("key, value").eq("is_public", true),
  ]);

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  const status = computeOpenStatus(
    hoursRes.data ?? [],
    settings.store_temporarily_closed === true,
    typeof settings.closed_message === "string" ? settings.closed_message : undefined
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Horarios</h1>
        <p className="text-sm text-muted-foreground">
          Define cuándo el catálogo acepta pedidos
        </p>
      </header>

      <HoursManager
        initial={hoursRes.data ?? []}
        statusMessage={status.message}
        isOpenNow={status.isOpen}
      />
    </div>
  );
}
