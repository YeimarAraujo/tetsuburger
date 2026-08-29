"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Download, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Filters {
  from: string;
  to: string;
}

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export function FinanzasManager({
  orders,
  expenses,
  production,
  closings,
  filters,
}: {
  orders: { id: string; status: string; total: number | string; subtotal: number | string; delivery_fee: number | string; delivery_fee_retained: boolean; payment_method: string | null; origin: string; created_at: string }[];
  expenses: { id: string; expense_date: string; amount: number | string; concept: string; category?: { name: string } | null }[];
  production: { id: string; record_date: string; total_cost: number | string }[];
  closings: { id: string; closing_date: string; orders_count: number; sales_total: number | string; expenses_total: number | string; estimated_profit: number | string }[];
  filters: Filters;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELADO");
    const cancelled = orders.length - validOrders.length;

    // Ingresos por ventas = SOLO el valor de los productos (subtotal).
    // Los domicilios no se incluyen: ni retenidos ni externos.
    const subtotalSales = validOrders.reduce((s, o) => s + Number(o.subtotal), 0);
    const sales = subtotalSales;
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const prodCost = production.reduce((s, p) => s + Number(p.total_cost), 0);

    const byMethod: Record<string, { count: number; total: number }> = {};
    validOrders.forEach((o) => {
      const m = o.payment_method ?? "EFECTIVO";
      if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
      byMethod[m].count++;
      byMethod[m].total += Number(o.subtotal);
    });

    const byOrigin: Record<string, number> = {};
    validOrders.forEach((o) => {
      byOrigin[o.origin] = (byOrigin[o.origin] || 0) + Number(o.subtotal);
    });

    // Gastos por categoría
    const expByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category?.name ?? "Sin categoría";
      expByCategory[cat] = (expByCategory[cat] || 0) + Number(e.amount);
    });

    // Utilidad neta = ventas - gastos operativos - costos producción
    const netProfit = sales - expTotal - prodCost;
    const margin = sales > 0 ? ((netProfit / sales) * 100) : 0;

    return {
      validOrdersCount: validOrders.length,
      cancelled,
      sales,
      expenses: expTotal,
      prodCost,
      netProfit,
      margin,
      byMethod,
      byOrigin,
      expByCategory,
      totalDelivered: validOrders.length,
    };
  }, [orders, expenses, production]);

  // Utilidad diaria (solo días con cierre)
  const dailyData = useMemo(() => {
    return closings.map((c) => ({
      date: c.closing_date,
      sales: Number(c.sales_total),
      expenses: Number(c.expenses_total),
      profit: Number(c.estimated_profit),
      orders: c.orders_count,
    }));
  }, [closings]);

  function pushFrom(from: string) {
    const q = new URLSearchParams({ from, to: filters.to });
    startTransition(() => router.push(`/admin/finanzas?${q.toString()}`));
  }
  function pushTo(to: string) {
    const q = new URLSearchParams({ from: filters.from, to });
    startTransition(() => router.push(`/admin/finanzas?${q.toString()}`));
  }

  const exportHref = useMemo(() => {
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    return `/admin/export/finanzas?${q.toString()}`;
  }, [filters]);

  return (
    <>
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <Input type="date" value={filters.from} onChange={(e) => pushFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <Input type="date" value={filters.to} onChange={(e) => pushTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "Hoy", from: bogotaToday(), to: bogotaToday() },
              { label: "7 días", from: shiftDays(-6), to: bogotaToday() },
              { label: "30 días", from: shiftDays(-29), to: bogotaToday() },
              { label: "Este mes", from: `${bogotaToday().slice(0, 8)}01`, to: bogotaToday() },
            ].map((r) => (
              <button
                key={r.label}
                onClick={() => { pushFrom(r.from); }}
                className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <a href={exportHref}>
              <Button variant="outline" size="sm">
                <Download className="size-4" />
                Exportar CSV
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingresos por venta (productos)</p>
                <p className="text-xl font-bold text-emerald-600">{formatCOP(stats.sales)}</p>
                <p className="text-[10px] text-muted-foreground">
                  Sin domicilios · {stats.validOrdersCount} pedidos
                  {stats.cancelled > 0 ? ` · ${stats.cancelled} cancelados` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
                <TrendingDown className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gastos operativos</p>
                <p className="text-xl font-bold text-red-600">{formatCOP(stats.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
                <DollarSign className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compras materia prima</p>
                <p className="text-xl font-bold text-amber-600">{formatCOP(stats.prodCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-xl ${stats.netProfit >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}`}>
                <Wallet className={`size-5 ${stats.netProfit >= 0 ? "text-blue-600" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilidad neta</p>
                <p className={`text-xl font-bold ${stats.netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCOP(stats.netProfit)}
                </p>
                <p className="text-[10px] text-muted-foreground">Margen: {stats.margin.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por método de pago */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ingresos por método de pago</CardTitle>
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
            <CardTitle className="text-sm">Gastos por categoría</CardTitle>
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
          <CardTitle className="text-sm">Ingresos por origen del pedido</CardTitle>
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
            <CardTitle className="text-sm">Utilidad por día (cierres)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 text-right font-medium">Pedidos</th>
                    <th className="pb-2 pr-4 text-right font-medium">Ventas</th>
                    <th className="pb-2 pr-4 text-right font-medium">Gastos</th>
                    <th className="pb-2 text-right font-medium">Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d) => (
                    <tr key={d.date} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{formatDate(`${d.date}T12:00:00Z`)}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{d.orders}</td>
                      <td className="py-2 pr-4 text-right text-emerald-600">{formatCOP(d.sales)}</td>
                      <td className="py-2 pr-4 text-right text-red-600">{formatCOP(d.expenses)}</td>
                      <td className={`py-2 text-right font-bold ${d.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {formatCOP(d.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Historial de gastos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Historial de gastos ({expenses.length})</CardTitle>
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
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(`${e.expense_date}T12:00:00Z`)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-[10px]">{e.category?.name ?? "Sin categoría"}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{e.concept}</td>
                      <td className="py-2 text-right font-semibold text-red-600">{formatCOP(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold">
                    <td colSpan={3} className="py-2 pr-4 text-right">Total gastos</td>
                    <td className="py-2 text-right text-red-600">{formatCOP(stats.expenses)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fórmula */}
      <Card className="border-dashed">
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          <p className="font-medium">Fórmula de utilidad neta</p>
          <p className="mt-1">
            <span className="text-emerald-600">Ventas de productos (sin domis)</span> −{" "}
            <span className="text-red-600">Gastos operativos</span> −{" "}
            <span className="text-amber-600">Compras de materia prima</span> ={" "}
            <span className="font-bold text-blue-600">Utilidad neta</span>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
