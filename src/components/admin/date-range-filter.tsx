"use client";

import type { ReactNode } from "react";
import { CalendarRange } from "lucide-react";
import { bogotaToday } from "@/lib/bogota";
import { addDays } from "@/lib/sales-analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Filtro de período compacto (una sola fila): desde – hasta, accesos rápidos
 * y, a la derecha, acciones propias de cada pantalla (CSV, categoría…).
 * Los accesos rápidos cambian las dos fechas en una sola navegación.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  pending = false,
  children,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  pending?: boolean;
  children?: ReactNode;
}) {
  const today = bogotaToday();
  const ranges = [
    { label: "Hoy", from: today, to: today },
    { label: "7 días", from: addDays(today, -6), to: today },
    { label: "30 días", from: addDays(today, -29), to: today },
    { label: "Este mes", from: `${today.slice(0, 8)}01`, to: today },
  ];

  return (
    <div
      role="group"
      aria-label="Período"
      className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2"
    >
      <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
      <Input
        type="date"
        aria-label="Desde"
        value={from}
        max={to}
        onChange={(e) => e.target.value && onChange(e.target.value, to)}
        className="h-8 w-[9.5rem] px-2 text-sm"
      />
      <span className="text-muted-foreground" aria-hidden="true">–</span>
      <Input
        type="date"
        aria-label="Hasta"
        value={to}
        min={from}
        onChange={(e) => e.target.value && onChange(from, e.target.value)}
        className="h-8 w-[9.5rem] px-2 text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {ranges.map((r) => {
          const active = from === r.from && to === r.to;
          return (
            <Button
              key={r.label}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={active}
              disabled={pending}
              onClick={() => onChange(r.from, r.to)}
            >
              {r.label}
            </Button>
          );
        })}
      </div>
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
