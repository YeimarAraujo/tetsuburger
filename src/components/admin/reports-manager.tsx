"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleDollarSign,
  Download,
  Flame,
  Gem,
  HelpCircle,
  Package,
  ReceiptText,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  Ticket,
  TrendingDown,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";
import {
  classifyMenu,
  daysInRange,
  eachDay,
  percentChange,
  splitExpenses,
  type MenuClass,
  type ProductSales,
  type SalesReport,
} from "@/lib/sales-analytics";
import type { ExpenseWithCategory } from "@/features/finance/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/admin/kpi-card";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { BarList, ColumnChart, PeakHeatmap, type ColumnDatum } from "@/components/admin/reports/charts";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import { cn } from "@/lib/utils";

export interface HistoryOrder {
  id: string;
  order_number: number;
  customer_name: string;
  subtotal: number;
  net: number;
  payment_method: string | null;
  origin: string;
  created_at: string;
  hamburguesas: number;
  perros: number;
}

interface ProductionRow {
  id: string;
  record_date: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  itemName: string | null;
}

interface Filters {
  from: string;
  to: string;
  category: string;
}


const shortDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "—";
}

/** Variación frente al período anterior, con flecha (no solo color). */
function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const change = percentChange(current, previous);
  if (change === null) return <span>Sin datos del período anterior</span>;
  const up = change >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
      <Icon className="size-3" aria-hidden="true" />
      {Math.abs(change).toFixed(0)}% vs. período anterior
    </span>
  );
}

function CsvLink({ href }: { href: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href}>
        <Download className="size-4" />
        CSV
      </a>
    </Button>
  );
}

export function ReportsManager({
  report,
  previous,
  reportUnavailable,
  orders,
  historyTruncated,
  expenses,
  production,
  filters,
  categories,
}: {
  report: SalesReport;
  previous: SalesReport;
  reportUnavailable: boolean;
  orders: HistoryOrder[];
  historyTruncated: boolean;
  expenses: ExpenseWithCategory[];
  production: ProductionRow[];
  filters: Filters;
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function pushFilter(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    const q = new URLSearchParams();
    q.set("from", merged.from);
    q.set("to", merged.to);
    if (merged.category !== "todas") q.set("cat", merged.category);
    startTransition(() => router.push(`/admin/reportes?${q.toString()}`));
  }

  const exportParams = useMemo(() => {
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.category !== "todas") q.set("cat", filters.category);
    return q.toString();
  }, [filters]);

  return (
    <div className={cn("space-y-6 transition-opacity", isPending && "opacity-60")}>
      {/* Filtros: una sola fila compacta para todo el reporte */}
      <div className="space-y-1.5">
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => pushFilter({ from, to })}
          pending={isPending}
        />
        <p className="px-1 text-xs text-muted-foreground">
          Solo se cuentan pedidos <span className="font-medium text-foreground">entregados</span>.
          {report.totals.in_progress > 0 ? ` ${report.totals.in_progress} en curso` : ""}
          {report.totals.cancelled > 0 ? `${report.totals.in_progress > 0 ? " ·" : ""} ${report.totals.cancelled} cancelados` : ""}
          {report.totals.in_progress > 0 || report.totals.cancelled > 0 ? " no se incluyen." : ""}
        </p>
      </div>

      {reportUnavailable ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardContent className="flex items-start gap-2 py-4 text-sm text-amber-900 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              Las gráficas de ventas y productos necesitan la migración{" "}
              <span className="font-mono">0033_sales_analytics.sql</span>. Aplícala en el SQL Editor de Supabase;
              mientras tanto se muestran los historiales.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="ventas" className="gap-4">
        <TabsList className="h-10! w-full sm:w-fit">
          <TabsTrigger value="ventas" className="px-2 sm:px-3">Ventas</TabsTrigger>
          <TabsTrigger value="productos" className="px-2 sm:px-3">Productos</TabsTrigger>
          <TabsTrigger value="gastos" className="px-2 sm:px-3">
            Gastos<span className="hidden sm:inline">&nbsp;y compras</span>
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="px-2 sm:px-3">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas">
          <SalesTab report={report} previous={previous} filters={filters} />
        </TabsContent>

        <TabsContent value="productos">
          <ProductsTab report={report} exportParams={exportParams} />
        </TabsContent>

        <TabsContent value="gastos">
          <ExpensesTab
            expenses={expenses}
            production={production}
            categories={categories}
            category={filters.category}
            onCategory={(category) => pushFilter({ category })}
            exportParams={exportParams}
            filters={filters}
          />
        </TabsContent>

        <TabsContent value="pedidos">
          <OrdersTab orders={orders} truncated={historyTruncated} exportParams={exportParams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================================ Ventas ================================ */

function SalesTab({ report, previous, filters }: { report: SalesReport; previous: SalesReport; filters: Filters }) {
  const t = report.totals;
  const p = previous.totals;
  const ticket = t.orders > 0 ? t.sales / t.orders : 0;
  const prevTicket = p.orders > 0 ? p.sales / p.orders : 0;
  const profit = t.sales - t.cost;
  const prevProfit = p.sales - p.cost;
  const margin = t.sales > 0 ? (profit / t.sales) * 100 : 0;

  const series = useMemo<ColumnDatum[]>(() => {
    const byDay = new Map(report.daily.map((d) => [d.date, d]));
    const days = eachDay(filters.from, filters.to);
    // Más de 2 meses: se agrupa por semana para que las barras sigan legibles.
    if (days.length > 62) {
      const weeks: ColumnDatum[] = [];
      for (let i = 0; i < days.length; i += 7) {
        const chunk = days.slice(i, i + 7);
        const value = chunk.reduce((s, d) => s + (byDay.get(d)?.sales ?? 0), 0);
        const orders = chunk.reduce((s, d) => s + (byDay.get(d)?.orders ?? 0), 0);
        const first = new Date(`${chunk[0]}T12:00:00Z`);
        const last = new Date(`${chunk[chunk.length - 1]}T12:00:00Z`);
        weeks.push({
          key: chunk[0],
          label: shortDate.format(first),
          fullLabel: `Semana ${shortDate.format(first)} – ${shortDate.format(last)}`,
          value,
          detail: `${orders} pedido${orders === 1 ? "" : "s"}`,
        });
      }
      return weeks;
    }
    return days.map((d) => {
      const date = new Date(`${d}T12:00:00Z`);
      const row = byDay.get(d);
      return {
        key: d,
        label: shortDate.format(date),
        fullLabel: longDate.format(date),
        value: row?.sales ?? 0,
        detail: `${row?.orders ?? 0} pedido${row?.orders === 1 ? "" : "s"}`,
      };
    });
  }, [report.daily, filters.from, filters.to]);

  const weekly = daysInRange(filters.from, filters.to) > 62;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={ShoppingCart}
          label="Ventas (productos, sin domicilios)"
          value={formatCOP(t.sales)}
          caption={<Delta current={t.sales} previous={p.sales} />}
          help={{
            what: "Valor neto de los productos de los pedidos entregados (subtotal menos ajustes del valor final). No incluye domicilios.",
            formula: "Σ (subtotal − ajuste) · pedidos ENTREGADO",
          }}
        />
        <KpiCard
          icon={ReceiptText}
          label="Pedidos entregados"
          value={t.orders}
          caption={<Delta current={t.orders} previous={p.orders} />}
        />
        <KpiCard
          icon={Ticket}
          label="Ticket promedio"
          value={formatCOP(ticket)}
          caption={<Delta current={ticket} previous={prevTicket} />}
          help={{
            what: "Cuánto deja en promedio cada pedido entregado.",
            formula: "ventas ÷ pedidos entregados",
            suggestion: "Súbelo con combos y sugiriendo adicionales o bebidas.",
          }}
        />
        <KpiCard
          icon={Wallet}
          label="Ganancia bruta"
          value={formatCOP(profit)}
          caption={
            <span>
              Margen {margin.toFixed(1)}% · <Delta current={profit} previous={prevProfit} />
            </span>
          }
          help={{
            what: "Lo que queda de las ventas después de pagar ingredientes, empaques y adicionales (costo guardado en cada venta). Aún no descuenta gastos fijos.",
            formula: "ventas − costo de lo vendido",
          }}
        />
        <KpiCard
          icon={Flame}
          label="Unidades vendidas"
          value={t.units}
          caption={`🍔 ${t.hamburguesas} · 🌭 ${t.perros} · todas las unidades de producto`}
          help={{
            what: "Cantidad de productos vendidos (incluye bebidas y acompañamientos). Hamburguesas y perros cuentan cada unidad dentro de los combos.",
          }}
        />
        {t.adjustments !== 0 ? (
          <KpiCard
            icon={TrendingDown}
            label="Ajustes del valor final"
            value={formatCOP(t.adjustments)}
            caption="Descuentos o cambios de total aplicados en el tablero"
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{weekly ? "Ventas por semana" : "Ventas por día"}</CardTitle>
          <CardDescription>Valor neto de productos entregados</CardDescription>
        </CardHeader>
        <CardContent>
          {t.orders === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas entregadas en este período.</p>
          ) : (
            <ColumnChart data={series} valueLabel="Ventas" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Días y horas pico</CardTitle>
          <CardDescription>Pedidos entregados según la hora en que se hicieron. Útil para turnos y compras.</CardDescription>
        </CardHeader>
        <CardContent>
          <PeakHeatmap cells={report.heatmap} />
        </CardContent>
      </Card>
    </div>
  );
}

/* =============================== Productos =============================== */

type SortKey = "units" | "revenue" | "profit" | "margin";

const MENU_CLASS: Record<MenuClass, { title: string; icon: typeof Star; what: string; action: string }> = {
  estrella: {
    title: "Estrellas",
    icon: Star,
    what: "Se venden mucho y dejan buena ganancia.",
    action: "Mantén la calidad y el precio, y muéstralos primero en el menú.",
  },
  caballo: {
    title: "Caballitos de batalla",
    icon: Flame,
    what: "Se venden mucho pero dejan poca ganancia por unidad.",
    action: "Sube el precio de a poco o baja su costo (porción, empaque, proveedor).",
  },
  rompecabezas: {
    title: "Rompecabezas",
    icon: Gem,
    what: "Dejan buena ganancia pero se venden poco.",
    action: "Promociónalos: destacados, fotos, sugerirlos en WhatsApp o en combos.",
  },
  perro: {
    title: "Por revisar",
    icon: HelpCircle,
    what: "Se venden poco y dejan poca ganancia.",
    action: "Rediséñalos, cámbiales el precio o considera sacarlos del menú.",
  },
};

function ProductsTab({ report, exportParams }: { report: SalesReport; exportParams: string }) {
  const [tipo, setTipo] = useState<"todos" | "hamburguesas" | "perros">("todos");
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "units", dir: "desc" });

  const totalUnits = report.products.reduce((s, p) => s + p.units, 0);
  const totalRevenue = report.products.reduce((s, p) => s + p.revenue, 0);

  const rows = useMemo(() => {
    const value = (p: ProductSales) => {
      const profit = p.revenue - p.cost;
      if (sort.key === "revenue") return p.revenue;
      if (sort.key === "profit") return profit;
      if (sort.key === "margin") return p.revenue > 0 ? profit / p.revenue : 0;
      return tipo === "hamburguesas" ? p.hamburguesas : tipo === "perros" ? p.perros : p.units;
    };
    return report.products
      .filter((p) => (tipo === "hamburguesas" ? p.hamburguesas > 0 : tipo === "perros" ? p.perros > 0 : true))
      .sort((a, b) => (sort.dir === "desc" ? value(b) - value(a) : value(a) - value(b)));
  }, [report.products, tipo, sort]);

  const maxUnits = Math.max(1, ...rows.map((r) => r.units));
  const productPages = usePagination(rows);
  const addonPages = usePagination(report.addons);
  const menu = useMemo(() => classifyMenu(report.products), [report.products]);
  const missingCost = report.products.filter((p) => p.units > 0 && p.cost <= 0);

  function sortHeader(k: SortKey, children: ReactNode, hideClass = "") {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
    return (
      <th key={k} className={cn("pb-2 pr-2 text-right font-medium", hideClass)} aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
        >
          {children}
          <Icon className="size-3" aria-hidden="true" />
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Más vendidos</CardTitle>
              <CardDescription>
                Ingresos con adicionales incluidos; la ganancia usa el costo guardado en cada venta.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger className="w-40" aria-label="Filtrar por tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hamburguesas">Hamburguesas</SelectItem>
                  <SelectItem value="perros">Perros</SelectItem>
                </SelectContent>
              </Select>
              <CsvLink href={`/admin/export/mas-vendidos?${exportParams}&tipo=${tipo}`} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas entregadas en este período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="hidden pb-2 pr-2 font-medium sm:table-cell">#</th>
                  <th className="pb-2 pr-2 font-medium">Producto</th>
                  {sortHeader("units", tipo === "todos" ? "Unidades" : tipo === "hamburguesas" ? "🍔" : "🌭", "hidden sm:table-cell")}
                  <th className="hidden pb-2 pr-2 text-right font-medium md:table-cell">% ventas</th>
                  {sortHeader("revenue", "Ingresos")}
                  {sortHeader("profit", "Ganancia")}
                  {sortHeader("margin", "Margen", "hidden sm:table-cell")}
                </tr>
              </thead>
              <tbody>
                {productPages.visible.map((p, i) => {
                  const profit = p.revenue - p.cost;
                  const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                  const shown = tipo === "hamburguesas" ? p.hamburguesas : tipo === "perros" ? p.perros : p.units;
                  return (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="hidden py-2 pr-2 text-muted-foreground tabular-nums sm:table-cell">{productPages.offset + i + 1}</td>
                      <td className="py-2 pr-2">
                        <p className="font-medium">{p.name}</p>
                        {p.category ? <p className="text-[11px] text-muted-foreground">{p.category}</p> : null}
                        <p className="text-[11px] text-muted-foreground sm:hidden">
                          {productPages.offset + i + 1}.º · {shown} {tipo === "todos" ? "u" : tipo === "hamburguesas" ? "🍔" : "🌭"}
                          {p.cost > 0 ? ` · ${margin.toFixed(0)}%` : ""}
                        </p>
                      </td>
                      <td className="hidden py-2 pr-2 sm:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <span className="hidden h-2.5 w-20 overflow-hidden rounded-r-[4px] bg-muted sm:block" aria-hidden="true">
                            <span className="block h-full rounded-r-[4px] bg-primary" style={{ width: `${(p.units / maxUnits) * 100}%` }} />
                          </span>
                          <span className="w-10 text-right font-semibold tabular-nums">{shown}</span>
                        </div>
                      </td>
                      <td className="hidden py-2 pr-2 text-right tabular-nums text-muted-foreground md:table-cell">{pct(p.revenue, totalRevenue)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCOP(p.revenue)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {p.cost > 0 ? formatCOP(profit) : <span className="text-muted-foreground">sin costo</span>}
                      </td>
                      <td className="hidden py-2 text-right tabular-nums sm:table-cell">{p.cost > 0 ? `${margin.toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2 pr-2 text-right sm:hidden">Total · {totalUnits} u</td>
                  <td colSpan={2} className="hidden py-2 pr-2 text-right sm:table-cell">Total</td>
                  <td className="hidden py-2 pr-2 text-right tabular-nums sm:table-cell">{totalUnits}</td>
                  <td className="hidden md:table-cell" />
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCOP(totalRevenue)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {formatCOP(totalRevenue - report.products.reduce((s, p) => s + p.cost, 0))}
                  </td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          )}
          <TablePagination pager={productPages} />
          {missingCost.length > 0 ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {missingCost.length} producto{missingCost.length > 1 ? "s" : ""} sin costo registrado (
              {missingCost.map((p) => p.name).join(", ")}): su ganancia no se puede calcular. Configura su receta en Productos.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {menu.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Matriz de menú
            </CardTitle>
            <CardDescription>
              Cruza cuánto se vende cada producto con cuánto deja por unidad, comparado con el promedio de tu menú.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(["estrella", "caballo", "rompecabezas", "perro"] as MenuClass[]).map((cls) => {
              const meta = MENU_CLASS[cls];
              const items = menu.filter((m) => m.menuClass === cls).sort((a, b) => b.units - a.units);
              const Icon = meta.icon;
              return (
                <div key={cls} className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <Icon className="size-4 text-price" aria-hidden="true" />
                    {meta.title}
                    <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta.what}</p>
                  {items.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {items.map((m) => (
                        <li key={m.key} className="flex justify-between gap-2">
                          <span className="truncate">{m.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {m.units} u · {formatCOP(m.marginPerUnit)}/u
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Ninguno en este período.</p>
                  )}
                  {items.length > 0 ? (
                    <p className="mt-2 border-t pt-2 text-xs">
                      <span className="font-medium">Qué hacer: </span>
                      {meta.action}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Adicionales</CardTitle>
          <CardDescription>Extras vendidos dentro de los productos (unidades reales, incluidos los “a cada producto del combo”).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {report.addons.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sin adicionales vendidos en este período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Adicional</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium sm:table-cell">Unidades</th>
                  <th className="pb-2 pr-2 text-right font-medium">Ingresos</th>
                  <th className="pb-2 pr-2 text-right font-medium">Ganancia</th>
                  <th className="hidden pb-2 text-right font-medium sm:table-cell">Margen</th>
                </tr>
              </thead>
              <tbody>
                {addonPages.visible.map((a) => {
                  const profit = a.revenue - a.cost;
                  return (
                    <tr key={a.key} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">
                        {a.name}
                        <span className="block text-[11px] font-normal text-muted-foreground sm:hidden">{a.units} u</span>
                      </td>
                      <td className="hidden py-2 pr-2 text-right tabular-nums sm:table-cell">{a.units}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCOP(a.revenue)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {a.cost > 0 ? formatCOP(profit) : <span className="text-muted-foreground">sin costo</span>}
                      </td>
                      <td className="hidden py-2 text-right tabular-nums sm:table-cell">
                        {a.cost > 0 && a.revenue > 0 ? `${((profit / a.revenue) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <TablePagination pager={addonPages} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================ Gastos y compras ============================ */

function ExpensesTab({
  expenses,
  production,
  categories,
  category,
  onCategory,
  exportParams,
  filters,
}: {
  expenses: ExpenseWithCategory[];
  production: ProductionRow[];
  categories: { id: number; name: string }[];
  category: string;
  onCategory: (category: string) => void;
  exportParams: string;
  filters: Filters;
}) {
  const { operating, includedInCost } = splitExpenses(expenses);
  const prodTotal = production.reduce((s, p) => s + p.total_cost, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, { value: number; inCost: boolean }>();
    for (const e of expenses) {
      const name = e.category?.name ?? "Sin categoría";
      const cur = map.get(name) ?? { value: 0, inCost: e.includedInProductCost };
      cur.value += e.amount;
      map.set(name, cur);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, v]) => ({ key: name, label: name, value: v.value, note: v.inCost ? "en costo" : undefined }));
  }, [expenses]);

  const byItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of production) {
      const name = p.itemName ?? (p.description || "Sin insumo");
      map.set(name, (map.get(name) ?? 0) + p.total_cost);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ key: name, label: name, value }));
  }, [production]);

  const expensePages = usePagination(expenses);
  const productionPages = usePagination(production);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={CircleDollarSign}
          tileClassName="bg-red-500/10"
          iconClassName="text-red-600"
          label="Gastos operativos"
          value={formatCOP(operating)}
          caption={`${expenses.length} registros`}
          help={{
            what: "Gastos del período que se restan de la utilidad. Los de categorías que ya están en el costo de cada producto (Empaques) se muestran aparte.",
          }}
        />
        <KpiCard
          icon={Package}
          label="Empaques (en el costo)"
          value={formatCOP(includedInCost)}
          caption="Ya incluidos en el costo de lo vendido"
        />
        <KpiCard
          icon={Package}
          tileClassName="bg-amber-500/10"
          iconClassName="text-amber-600"
          label="Compras de materia prima"
          value={formatCOP(prodTotal)}
          caption={`${production.length} registros`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={byCategory} emptyText="Sin gastos en este período." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compras por insumo</CardTitle>
            <CardDescription>Los 10 insumos en los que más se gastó</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList data={byItem} emptyText="Sin compras en este período." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Historial de gastos</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={category} onValueChange={onCategory}>
                <SelectTrigger className="w-44" aria-label="Categoría de gasto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CsvLink href={`/admin/export/expenses?${exportParams}`} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos en este período</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Fecha</th>
                    <th className="hidden pb-2 pr-2 font-medium sm:table-cell">Categoría</th>
                    <th className="pb-2 pr-2 font-medium">Concepto</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePages.visible.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDate(`${e.expense_date}T12:00:00Z`)}</td>
                      <td className="hidden py-2 pr-2 sm:table-cell">
                        {e.category?.name ?? "—"}
                        {e.includedInProductCost ? <span className="ml-1.5 text-[10px] text-muted-foreground">en costo</span> : null}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {e.concept}
                        <span className="block text-[11px] sm:hidden">
                          {e.category?.name ?? "—"}
                          {e.includedInProductCost ? " · en costo" : ""}
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums">{formatCOP(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold">
                    <td colSpan={2} className="py-2 pr-2 text-right sm:hidden">Total del período</td>
                    <td colSpan={3} className="hidden py-2 pr-2 text-right sm:table-cell">Total del período</td>
                    <td className="py-2 text-right tabular-nums">{formatCOP(operating + includedInCost)}</td>
                  </tr>
                </tfoot>
              </table>
              <TablePagination pager={expensePages} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Historial de compras</CardTitle>
            <CsvLink href={`/admin/export/produccion?from=${filters.from}&to=${filters.to}`} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {production.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin compras en este período</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="hidden pb-2 pr-2 font-medium sm:table-cell">Fecha</th>
                    <th className="pb-2 pr-2 font-medium">Insumo</th>
                    <th className="hidden pb-2 pr-2 font-medium md:table-cell">Descripción</th>
                    <th className="pb-2 pr-2 text-right font-medium">Cantidad</th>
                    <th className="hidden pb-2 pr-2 text-right font-medium sm:table-cell">Costo/ud</th>
                    <th className="pb-2 text-right font-medium">Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {productionPages.visible.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="hidden py-2 pr-2 whitespace-nowrap sm:table-cell">{formatDate(`${p.record_date}T12:00:00Z`)}</td>
                      <td className="py-2 pr-2">
                        {p.itemName ?? "—"}
                        <span className="block text-[11px] text-muted-foreground sm:hidden">
                          {formatDate(`${p.record_date}T12:00:00Z`)}
                          {p.description ? ` · ${p.description}` : ""}
                        </span>
                      </td>
                      <td className="hidden py-2 pr-2 text-muted-foreground md:table-cell">{p.description || "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{p.quantity} {p.unit}</td>
                      <td className="hidden py-2 pr-2 text-right tabular-nums text-muted-foreground sm:table-cell">{formatCOP(p.unit_cost)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{formatCOP(p.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold">
                    <td className="py-2 pr-2 text-right sm:hidden" colSpan={2}>Total compras</td>
                    <td className="hidden py-2 pr-2 text-right sm:table-cell md:hidden" colSpan={4}>Total compras</td>
                    <td className="hidden py-2 pr-2 text-right md:table-cell" colSpan={5}>Total compras</td>
                    <td className="py-2 text-right tabular-nums">{formatCOP(prodTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              <TablePagination pager={productionPages} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================ Pedidos ================================ */

function OrdersTab({
  orders,
  truncated,
  exportParams,
}: {
  orders: HistoryOrder[];
  truncated: boolean;
  exportParams: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    const num = q.replace(/^#/, "");
    const numOnly = /^\d+$/.test(num);
    return orders.filter(
      (o) => (numOnly && String(o.order_number).includes(num)) || (o.customer_name || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  const pages = usePagination(filtered);
  const total = filtered.reduce((s, o) => s + o.net, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Historial de pedidos entregados</CardTitle>
            <CardDescription>{orders.length} pedidos en el período</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  pages.setPage(0);
                }}
                placeholder="# pedido o cliente…"
                aria-label="Buscar por número de pedido o cliente"
                className="h-9 w-52 pl-8"
              />
            </div>
            <CsvLink href={`/admin/export/pedidos?${exportParams}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pedidos entregados en este período</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin resultados para “{search.trim()}”</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="hidden pb-2 pr-2 font-medium sm:table-cell">Fecha</th>
                  <th className="pb-2 pr-2 font-medium">Cliente</th>
                  <th className="hidden pb-2 pr-2 font-medium md:table-cell">Pago</th>
                  <th className="hidden pb-2 pr-2 font-medium lg:table-cell">🍔/🌭</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium md:table-cell">Subtotal</th>
                  <th className="pb-2 text-right font-medium">Total<span className="hidden sm:inline"> (sin domicilio)</span></th>
                </tr>
              </thead>
              <tbody>
                {pages.visible.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-bold text-muted-foreground tabular-nums">#{o.order_number}</td>
                    <td className="hidden py-2 pr-2 whitespace-nowrap sm:table-cell">{formatDate(o.created_at)}</td>
                    <td className="py-2 pr-2">
                      {o.customer_name || "—"}
                      <span className="block text-[11px] text-muted-foreground sm:hidden">{formatDate(o.created_at)}</span>
                    </td>
                    <td className="hidden py-2 pr-2 text-xs md:table-cell">
                      {o.payment_method === "TRANSFERENCIA" ? "Transferencia" : "Efectivo"}
                      <span className="text-muted-foreground"> · {o.origin === "WEB" ? "Web" : "Manual"}</span>
                    </td>
                    <td className="hidden py-2 pr-2 text-xs whitespace-nowrap lg:table-cell">
                      {o.hamburguesas || o.perros ? `${o.hamburguesas} 🍔 · ${o.perros} 🌭` : "—"}
                    </td>
                    <td className="hidden py-2 pr-2 text-right tabular-nums md:table-cell">{formatCOP(o.subtotal)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatCOP(o.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={2} className="py-2 pr-2 text-right sm:hidden">
                    Total{search.trim() ? ` (${filtered.length})` : ""}
                  </td>
                  <td colSpan={3} className="hidden py-2 pr-2 text-right sm:table-cell md:hidden">
                    Total{search.trim() ? ` (${filtered.length} resultados)` : ""}
                  </td>
                  <td colSpan={5} className="hidden py-2 pr-2 text-right md:table-cell lg:hidden">
                    Total{search.trim() ? ` (${filtered.length} resultados)` : ""}
                  </td>
                  <td colSpan={6} className="hidden py-2 pr-2 text-right lg:table-cell">
                    Total{search.trim() ? ` (${filtered.length} resultados)` : ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCOP(total)}</td>
                </tr>
              </tfoot>
            </table>
            <TablePagination pager={pages} />
            {truncated ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Se muestran los 1.000 pedidos más recientes; el CSV incluye todo el período.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
