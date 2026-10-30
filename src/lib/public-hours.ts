import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HourRow } from "@/lib/business-hours";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

async function loadHours(): Promise<HourRow[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("business_hours")
      .select("day_of_week, opens_at, closes_at, is_active")
      .order("day_of_week");
    return (data ?? []) as HourRow[];
  } catch {
    return [];
  }
}

/** Horario público cacheado (se invalida con el tag `hours`). */
export const getPublicHours = unstable_cache(loadHours, ["public-hours"], {
  revalidate: 300,
  tags: ["hours"],
});

function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (sorted.length === 1) return DAY_SHORT[sorted[0]] ?? "";
  if (consecutive) return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

/** Resume el horario en una línea legible; `null` si no hay datos. */
export function formatHoursSummary(rows: HourRow[]): string | null {
  const active = rows.filter((r) => r.is_active);
  if (active.length === 0) return null;

  const groups = new Map<string, number[]>();
  for (const row of active) {
    const range = `${row.opens_at.slice(0, 5)}–${row.closes_at.slice(0, 5)}`;
    const days = groups.get(range) ?? [];
    days.push(row.day_of_week);
    groups.set(range, days);
  }

  return [...groups.entries()]
    .map(([range, days]) => `${daysLabel(days)}: ${range}`)
    .join(" · ");
}
