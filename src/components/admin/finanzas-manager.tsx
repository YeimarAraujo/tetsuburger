"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, DollarSign, Download, Package, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/admin/kpi-card";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { splitExpenses } from "@/lib/sales-analytics";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";

interface Filters {
  from: string;
  to: string;
}

export function FinanzasManager({
  orders,
  expenses,
  production,
  closings,
  cogsTotal,
  missingCostCount,
  filters,
}: {
  orders: { id: string; status: string; total: number | string; subtotal: number | string; final_adjustment?: number | string | null; delivery_fee: number | string; delivery_fee_retained: boolean; payment_method: string | null; origin: string; created_at: string }[];
  expenses: { id: string; expense_date: string; amount: number | string; concept: string; category?: { name: string } | null; includedInProductCost?: boolean }[];
  production: { id: string; record_date: string; total_cost: number | string }[];
  closings: { id: string; closing_date: string; orders_count: number; sales_total: number | string; expenses_total: number | string; estimated_profit: number | string; details?: Record<string, unknown> | null }[];
  cogsTotal: number;
  missingCostCount: number;
  filters: Filters;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELADO");
    const cancelled = orders.length - validOrders.length;

    // Las ventas del período son SOLO los pedidos ENTREGADO (máximo realismo).
    const deliveredOrders = orders.filter((o) => o.status === "ENTREGADO");

    // Ingresos por ventas = valor neto de los productos (subtotal menos el
    // ajuste del valor final, si lo hay). Los domicilios no se incluyen: ni
    // retenidos ni externos.
    const netProducts = (o: { subtotal: number | string; final_adjustment?: number | string | null }) =>
      Number(o.subtotal) - Number(o.final_adjustment ?? 0);
    const subtotalSales = deliveredOrders.reduce((s, o) => s + netProducts(o), 0);
    const sales = subtotalSales;
    // Los gastos de categorías ya incluidas en el costo de cada producto
    // (Empaques) se muestran, pero no se restan otra vez de la utilidad.
    const { operating: expTotal, includedInCost } = splitExpenses(expenses);
    const prodCost = production.reduce((s, p) => s + Number(p.total_cost), 0);

    const byMethod: Record<string, { count: number; total: number }> = {};
    deliveredOrders.forEach((o) => {
      const m = o.payment_method ?? "EFECTIVO";
      if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
      byMethod[m].count++;
      byMethod[m].total += netProducts(o);
    });

    const byOrigin: Record<string, number> = {};
    deliveredOrders.forEach((o) => {
      byOrigin[o.origin] = (byOrigin[o.origin] || 0) + netProducts(o);
    });

    // Gastos por categoría
    const expByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category?.name ?? "Sin categoría";
      expByCategory[cat] = (expByCategory[cat] || 0) + Number(e.amount);
    });

    // Utilidad neta = ventas entregadas − costo de lo vendido − gastos.
    // Las compras de materia prima están implícitas en el costo de lo vendido
    // (no se restan por separado para evitar el doble conteo).
    const netProfit = sales - cogsTotal - expTotal;
    const margin = sales > 0 ? ((netProfit / sales) * 100) : 0;

    return {
      deliveredOrdersCount: deliveredOrders.length,
      cancelled,
      sales,
      cogs: cogsTotal,
      expenses: expTotal,
      includedInCost,
      prodCost,
      netProfit,
      margin,
      missingCostCount,
      byMethod,
      byOrigin,
      expByCategory,
      totalDelivered: deliveredOrders.length,
    };
  }, [orders, expenses, production, cogsTotal, missingCostCount]);

  // Utilidad diaria (solo días con cierre)
  // Los cierres creados antes de la fórmula con costo de lo vendido no traen
  // cogs_total; se marcan para mostrar una nota (históricos inmutables).
  const dailyData = useMemo(() => {
    return closings.map((c) => ({
      date: c.closing_date,
      sales: Number(c.sales_total),
      expenses: Number(c.expenses_total),
      cogs: Number((c.details as Record<string, unknown> | undefined)?.cogs_total ?? 0),
      profit: Number(c.estimated_profit),
      orders: c.orders_count,
      hasCogs: Boolean((c.details as Record<string, unknown> | undefined)?.cogs_total !== undefined),
    }));
  }, [closings]);

  const closingPages = usePagination(dailyData);
  const expensePages = usePagination(expenses);

  function pushRange(from: string, to: string) {
    const q = new URLSearchParams({ from, to });
    startTransition(() => router.push(`/admin/finanzas?${q.toString()}`));
  }

  const exportHref = useMemo(() => {
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    return `/admin/export/finanzas?${q.toString()}`;
  }, [filters]);

  return (
    <>
      {/* Filtros */}
      <DateRangeFilter from={filters.from} to={filters.to} onChange={pushRange} pending={isPending}>
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}>
            <Download className="size-4" />
            CSV
          </a>
        </Button>
      </DateRangeFilter>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          icon={TrendingUp}
          tileClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          label="Ingresos por venta"
          value={formatCOP(stats.sales)}
          valueClassName="text-xl text-emerald-600"
          caption={`Sin domicilios · ${stats.totalDelivered} pedidos entregados${stats.cancelled > 0 ? ` · ${stats.cancelled} cancelados` : ""}`}
          help={{
            what: "Suma del valor neto de los productos (subtotal menos ajustes del valor final) de los pedidos ENTREGADOS en el período. No incluye domicilios (ni retenidos ni externos).",
            formula: "Σ (subtotal − ajuste) · solo estado ENTREGADO",
            suggestion: "Compara el número de pedidos entregados vs. creados para medir cuánto se pierde entre pedido y entrega.",
          }}
        />

        <KpiCard
          icon={DollarSign}
          tileClassName="bg-fuchsia-500/10"
          iconClassName="text-fuchsia-600"
          label="Costo de lo vendido"
          value={formatCOP(stats.cogs)}
          valueClassName="text-xl text-fuchsia-600"
          caption={stats.sales > 0 ? `${((stats.cogs / stats.sales) * 100).toFixed(1)}% de las ventas` : "—"}
          help={{
            what: "Valor de los insumos + empaque vendidos en el período, según el costo configurado por producto.",
            formula: "Σ (cantidad vendida × costo del producto)",
            suggestion: "Si el costo de lo vendido sube de ~35% de las ventas, revisa precios o costos de insumos.",
          }}
        />

        <KpiCard
          icon={TrendingDown}
          tileClassName="bg-red-500/10"
          iconClassName="text-red-600"
          label="Gastos operativos"
          value={formatCOP(stats.expenses)}
          valueClassName="text-xl text-red-600"
          caption={
            stats.includedInCost > 0
              ? `+ ${formatCOP(stats.includedInCost)} en empaques (ya en el costo de lo vendido)`
              : undefined
          }
          help={{
            what: "Suma de los gastos registrados dentro del período. Los de categorías que ya forman parte del costo de cada producto (Empaques) no se suman aquí para no restarlos dos veces.",
            formula: "Σ monto · fecha en el filtro · sin categorías incluidas en el costo",
          }}
        />

        <KpiCard
          icon={Package}
          tileClassName="bg-amber-500/10"
          iconClassName="text-amber-600"
          label="Compras materia prima"
          value={formatCOP(stats.prodCost)}
          valueClassName="text-xl text-amber-600"
          caption="Ya incluidas en el costo de lo vendido"
          help={{
            what: "Valor de las compras registradas en Producción en el período. Es solo referencia: este costo vive dentro del costo de lo vendido y no se resta por separado para no contar dos veces.",
          }}
        />

        <KpiCard
          icon={Wallet}
          tileClassName={stats.netProfit >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}
          iconClassName={stats.netProfit >= 0 ? "text-blue-600" : "text-red-600"}
          label="Utilidad neta"
          value={formatCOP(stats.netProfit)}
          valueClassName={`text-xl ${stats.netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}
          caption={
            stats.missingCostCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                <AlertTriangle className="size-3.5" />
                {stats.missingCostCount} producto{stats.missingCostCount > 1 ? "s" : ""} sin costo · Margen {stats.margin.toFixed(1)}%
              </span>
            ) : (
              `Margen: ${stats.margin.toFixed(1)}%`
            )
          }
          help={{
            what: "Lo que queda del período después de pagar el costo de lo vendido y los gastos operativos.",
            formula: "Ingresos entregados − costo de lo vendido − gastos",
            suggestion: stats.netProfit < 0
              ? "Período en pérdida: revisa si las ventas alcanzan a cubrir costos + gastos fijos de la quincena."
              : "Si el margen baja de ~30%, revisa precios, costos de insumos o gastos fijos.",
          }}
        />
      </div>

      {/* Desglose por método de pago */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por método de pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.byMethod).map(([method, data]) => (
              <div key={method} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  {method === "EFECTIVO" ? "Efectivo" : "Transferencia"}
                  <Badge variant="outline" className="text-[10px]">{data.count}</Badge>
                </span>
                <span className="font-semibold">{formatCOP(data.total)}</span>
              </div>
            ))}
            {Object.keys(stats.byMethod).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.expByCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm">{cat}</span>
                <span className="font-semibold text-red-600">{formatCOP(total)}</span>
              </div>
            ))}
            {Object.keys(stats.expByCategory).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin gastos en este período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ingresos por origen */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por origen del pedido</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6">
          {Object.entries(stats.byOrigin).map(([origin, total]) => (
            <div key={origin} className="text-center">
              <Badge variant="secondary" className="mb-1">{origin}</Badge>
              <p className="text-lg font-bold">{formatCOP(total)}</p>
            </div>
          ))}
          {Object.keys(stats.byOrigin).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          )}
        </CardContent>
      </Card>

      {/* Historial de cierres */}
      {dailyData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Utilidad por día (cierres)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 text-right font-medium">Pedidos</th>
                    <th className="pb-2 pr-4 text-right font-medium">Ventas</th>
                    <th className="pb-2 pr-4 text-right font-medium">Costo vendido</th>
                    <th className="pb-2 pr-4 text-right font-medium">Gastos</th>
                    <th className="pb-2 text-right font-medium">Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {closingPages.visible.map((d) => (
                    <tr key={d.date} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{formatDate(`${d.date}T12:00:00Z`)}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{d.orders}</td>
                      <td className="py-2 pr-4 text-right text-emerald-600">{formatCOP(d.sales)}</td>
                      <td className="py-2 pr-4 text-right text-fuchsia-600">
                        {d.hasCogs ? formatCOP(d.cogs) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-600">{formatCOP(d.expenses)}</td>
                      <td className={`py-2 text-right font-bold ${d.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {formatCOP(d.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination pager={closingPages} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Los cierres anteriores al cambio de fórmula (sin costo de lo vendido) muestran &ldquo;—&rdquo; y conservan su
                histórico inmutable.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Historial de gastos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de gastos ({expenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos en este período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 font-medium">Categoría</th>
                    <th className="pb-2 pr-4 font-medium">Concepto</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePages.visible.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(`${e.expense_date}T12:00:00Z`)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-[10px]">{e.category?.name ?? "Sin categoría"}</Badge>
                        {e.includedInProductCost ? (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">en costo</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{e.concept}</td>
                      <td className="py-2 text-right font-semibold text-red-600">{formatCOP(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold">
                    <td colSpan={3} className="py-2 pr-4 text-right">Total gastos operativos</td>
                    <td className="py-2 text-right text-red-600">{formatCOP(stats.expenses)}</td>
                  </tr>
                </tfoot>
              </table>
              <TablePagination pager={expensePages} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fórmula */}
      <Card className="border-dashed">
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          <p className="font-medium">Fórmula de utilidad neta</p>
          <p className="mt-1">
            <span className="text-emerald-600">Ventas de productos entregados (sin domis)</span> −{" "}
            <span className="text-fuchsia-600">Costo de lo vendido</span> −{" "}
            <span className="text-red-600">Gastos operativos</span> ={" "}
            <span className="font-bold text-blue-600">Utilidad neta</span>
          </p>
          <p className="mt-1 text-[11px]">
            Las compras de materia prima y los gastos en empaques ya están dentro
            del costo de lo vendido (no se restan por separado).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
