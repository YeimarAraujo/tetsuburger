"use client";

import { useState, type ReactNode } from "react";
import { formatCOP, formatCOPCompact } from "@/lib/format";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import { cn } from "@/lib/utils";

/*
 * Gráficas de una sola serie con el color de marca (sin librerías).
 * Reglas: barras finas (≤ 24 px) con extremo redondeado de 4 px y base recta,
 * rejilla de 1 px recesiva, etiquetas selectivas, tooltip al pasar o enfocar,
 * y siempre una tabla equivalente para quien no puede leer la gráfica.
 */

/** Ejes "redondos": 0, mitad y máximo redondeado hacia arriba. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

export function TableToggle({ label = "Ver tabla", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

/* ------------------------- Ventas por día (columnas) ------------------------- */

export interface ColumnDatum {
  key: string;
  /** Etiqueta corta del eje (p. ej. "12 oct"). */
  label: string;
  /** Texto completo para tooltip y tabla. */
  fullLabel: string;
  value: number;
  detail?: string;
}

export function ColumnChart({
  data,
  valueLabel,
  height = 180,
}: {
  data: ColumnDatum[];
  valueLabel: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const tablePages = usePagination(data);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const ticks = [max, max / 2, 0];
  // Etiquetas del eje x selectivas: primera, del medio y última.
  const labelled = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  return (
    <div>
      <div className="flex gap-2">
        {/* Eje y */}
        <div className="flex flex-col justify-between text-right text-[10px] tabular-nums text-muted-foreground" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatCOPCompact(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Rejilla */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="h-px bg-border" />
            ))}
          </div>

          {/* Columnas */}
          <div className="relative flex items-end gap-0.5" style={{ height }} onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => {
              const pct = (d.value / max) * 100;
              return (
                <button
                  key={d.key}
                  type="button"
                  className="group flex h-full min-w-0 flex-1 items-end justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${d.fullLabel}: ${formatCOP(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
                >
                  <span
                    className={cn(
                      "block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity",
                      active !== null && active !== i && "opacity-40"
                    )}
                    style={{ height: d.value > 0 ? `max(${pct}%, 2px)` : 0 }}
                  />
                </button>
              );
            })}

            {active !== null && data[active] ? (
              <div
                role="status"
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
                style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
              >
                <p className="font-medium">{data[active].fullLabel}</p>
                <p className="tabular-nums">
                  {valueLabel}: <span className="font-semibold">{formatCOP(data[active].value)}</span>
                </p>
                {data[active].detail ? <p className="text-muted-foreground">{data[active].detail}</p> : null}
              </div>
            ) : null}
          </div>

          {/* Eje x */}
          <div className="mt-1.5 flex text-[10px] text-muted-foreground">
            {data.map((d, i) => (
              <span key={d.key} className="min-w-0 flex-1 text-center">
                {labelled.has(i) ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {data[peak] && data[peak].value > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Mejor: <span className="font-medium text-foreground">{data[peak].fullLabel}</span> con{" "}
          {formatCOP(data[peak].value)}
        </p>
      ) : null}

      <TableToggle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1.5 pr-2 font-medium">Fecha</th>
              <th className="pb-1.5 pr-2 text-right font-medium">{valueLabel}</th>
              <th className="pb-1.5 text-right font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {tablePages.visible.map((d) => (
              <tr key={d.key} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{d.fullLabel}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatCOP(d.value)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{d.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination pager={tablePages} />
      </TableToggle>
    </div>
  );
}

/* ------------------------- Barras horizontales ------------------------- */

export interface BarDatum {
  key: string;
  label: ReactNode;
  value: number;
  /** Texto a la derecha (por defecto, el valor en COP). */
  display?: string;
  note?: ReactNode;
}

/** Ranking en barras: es a la vez gráfica y tabla (nombre, barra, valor). */
export function BarList({ data, emptyText }: { data: BarDatum[]; emptyText: string }) {
  if (data.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 0) || 1;

  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <span className="truncate" title={typeof d.label === "string" ? d.label : undefined}>
            {d.label}
            {d.note ? <span className="ml-1.5 text-[10px] text-muted-foreground">{d.note}</span> : null}
          </span>
          <span className="h-3 overflow-hidden rounded-r-[4px] bg-muted" aria-hidden="true">
            <span
              className="block h-full rounded-r-[4px] bg-primary"
              style={{ width: `${Math.max(1, (d.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{d.display ?? formatCOP(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Horas pico ----------------------------- */

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const LEVELS = ["bg-primary/10", "bg-primary/30", "bg-primary/50", "bg-primary/75", "bg-primary"];

function hourLabel(h: number): string {
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${period}`;
}

/** Pedidos por día de la semana y hora (dow 0 = domingo, como en la base de datos). */
export function PeakHeatmap({
  cells,
}: {
  cells: { dow: number; hour: number; orders: number; sales: number }[];
}) {
  if (cells.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Sin pedidos entregados en este período.</p>;
  }

  // Lunes primero: dow 1..6, luego 0 (domingo).
  const rowOf = (dow: number) => (dow + 6) % 7;
  const minHour = Math.min(...cells.map((c) => c.hour));
  const maxHour = Math.max(...cells.map((c) => c.hour));
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
  const grid = new Map(cells.map((c) => [`${rowOf(c.dow)}-${c.hour}`, c]));
  const maxOrders = Math.max(...cells.map((c) => c.orders), 1);
  const level = (n: number) => (n <= 0 ? -1 : Math.min(LEVELS.length - 1, Math.floor((n / maxOrders) * LEVELS.length - 1e-9)));

  const top = [...cells].sort((a, b) => b.orders - a.orders || b.sales - a.sales).slice(0, 3);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px]">
          <thead>
            <tr>
              <th className="w-8" />
              {hours.map((h) => (
                <th key={h} scope="col" className="px-0.5 font-normal text-muted-foreground">
                  {hourLabel(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, row) => (
              <tr key={day}>
                <th scope="row" className="pr-1 text-left font-normal text-muted-foreground">
                  {day}
                </th>
                {hours.map((h) => {
                  const cell = grid.get(`${row}-${h}`);
                  const n = cell?.orders ?? 0;
                  const lv = level(n);
                  const text = `${DAY_NAMES[row]} ${hourLabel(h)}: ${n} pedido${n === 1 ? "" : "s"}${cell ? `, ${formatCOP(cell.sales)}` : ""}`;
                  return (
                    <td
                      key={h}
                      title={text}
                      aria-label={text}
                      className={cn("size-6 min-w-6 rounded-[4px]", lv < 0 ? "bg-muted/60" : LEVELS[lv])}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          Menos
          {LEVELS.map((c) => (
            <span key={c} className={cn("size-3 rounded-[3px]", c)} />
          ))}
          Más pedidos
        </span>
      </div>

      <p className="mt-3 text-sm">
        <span className="font-medium">Momentos más fuertes: </span>
        {top
          .map((c) => `${DAY_NAMES[rowOf(c.dow)]} ${hourLabel(c.hour)} (${c.orders} pedido${c.orders === 1 ? "" : "s"})`)
          .join(" · ")}
      </p>
    </div>
  );
}
