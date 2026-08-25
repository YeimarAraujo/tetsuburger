"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { HourRow } from "@/lib/business-hours";
import { updateBusinessHour } from "@/features/hours/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lunes → Domingo
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface RowState {
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

export function HoursManager({
  initial,
  statusMessage,
  isOpenNow,
}: {
  initial: HourRow[];
  statusMessage: string;
  isOpenNow: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<Record<number, RowState>>(() => {
    const map: Record<number, RowState> = {};
    for (const h of initial) {
      map[h.day_of_week] = {
        opens_at: h.opens_at.slice(0, 5),
        closes_at: h.closes_at.slice(0, 5),
        is_active: h.is_active,
      };
    }
    return map;
  });

  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  function update(day: number, patch: Partial<RowState>, original: RowState) {
    setRows((prev) => {
      const next = { ...prev[day], ...patch };
      const changed =
        next.opens_at !== original.opens_at ||
        next.closes_at !== original.closes_at ||
        next.is_active !== original.is_active;

      setDirty((d) => {
        const s = new Set(d);
        if (changed) s.add(day);
        else s.delete(day);
        return s;
      });

      return { ...prev, [day]: next };
    });
  }

  async function saveRow(day: number) {
    const row = rows[day];
    if (!row) return;
    setSavingDay(day);

    const result = await updateBusinessHour({
      day_of_week: day,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
      is_active: row.is_active,
    });

    setSavingDay(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`${DAY_NAMES[day]} actualizado`);
    setDirty((d) => {
      const s = new Set(d);
      s.delete(day);
      return s;
    });
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario de atención</CardTitle>
        <CardDescription>
          El estado del catálogo se calcula automáticamente. Un cierre posterior
          a la apertura (ej: 18:00 → 02:00) se interpreta como cruce de
          medianoche.
        </CardDescription>
        <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          Estado actual:{" "}
          <span className={cn("font-bold", isOpenNow ? "text-emerald-600" : "text-red-600")}>
            {isOpenNow ? "🟢 ABIERTO" : "🔴 CERRADO"}
          </span>{" "}
          — {statusMessage}
        </div>
      </CardHeader>

      <CardContent>
        <div className="divide-y">
          {DAY_ORDER.map((day) => {
            const row = rows[day];
            if (!row) return null;
            const original: RowState = {
              opens_at: initial.find((h) => h.day_of_week === day)!.opens_at.slice(0, 5),
              closes_at: initial.find((h) => h.day_of_week === day)!.closes_at.slice(0, 5),
              is_active: initial.find((h) => h.day_of_week === day)!.is_active,
            };

            return (
              <div key={day} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 font-medium">{DAY_NAMES[day]}</span>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Abre
                  <Input
                    type="time"
                    value={row.opens_at}
                    disabled={!row.is_active}
                    onChange={(e) => update(day, { opens_at: e.target.value }, original)}
                    className="w-28"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Cierra
                  <Input
                    type="time"
                    value={row.closes_at}
                    disabled={!row.is_active}
                    onChange={(e) => update(day, { closes_at: e.target.value }, original)}
                    className="w-28"
                  />
                </label>

                <Switch
                  checked={row.is_active}
                  onCheckedChange={(checked) => update(day, { is_active: checked }, original)}
                  aria-label={`Activar ${DAY_NAMES[day]}`}
                />

                <Button
                  size="sm"
                  variant={dirty.has(day) ? "default" : "outline"}
                  disabled={!dirty.has(day) || savingDay === day || isPending}
                  onClick={() => saveRow(day)}
                >
                  {savingDay === day ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Guardar
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
