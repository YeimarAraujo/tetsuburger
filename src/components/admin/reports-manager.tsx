"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  customer_name: string;
  total: number;
  delivery_fee: number;
  payment_method: string | null;
  origin: string;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  expense_date: string;
  concept: string;
  amount: number;
  category_name: string | null;
}

interface Filters {
  from: string;
  to: string;
  category: string;
}

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function ReportsManager({
  orders,
  expenses,
  filters,
  categories,
}: {
  orders: OrderRow[];
  expenses: ExpenseRow[];
  filters: Filters;
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELADO");
    const sales = validOrders.reduce((s, o) => s + Number(o.total), 0);
    const fees = validOrders.reduce((s, o) => s + Number(o.delivery_fee), 0);
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byMethod: Record<string, number> = {};
    validOrders.forEach((o) => {
      const m = o.payment_method ?? "EFECTIVO";
      byMethod[m] = (byMethod[m] || 0) + Number(o.total);
    });
    return {
      ordersCount: validOrders.length,
      cancelledCount: orders.length - validOrders.length,
      sales,
      fees,
      expenses: expTotal,
      profit: sales - expTotal,
      byMethod,
    };
  }, [orders, expenses]);

  function pushFilter(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    const q = new URLSearchParams();
    q.set("from", merged.from);
    q.set("to", merged.to);
    if (merged.category !== "todas") q.set("cat", merged.category);
    startTransition(() => router.push(`/admin/reportes?${q.toString()}`));
  }

  const exportHref = useMemo(() => {
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.category !== "todas") q.set("cat", filters.category);
    return `/admin/export/reports?${q.toString()}`;
  }, [filters]);

  return (
    <>
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <Input type="date" value={filters.from} onChange={(e) => pushFilter({ from: e.target.value })} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <Input type="date" value={filters.to} onChange={(e) => pushFilter({ to: e.target.value })} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría de gasto</Label>
            <Select value={filters.category} onValueChange={(v) => pushFilter({ category: v })}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "Hoy", from: bogotaToday(), to: bogotaToday() },
              { label: "7 días", from: shiftDays(-6), to: bogotaToday() },
              { label: "30 días", from: shiftDays(-29), to: bogotaToday() },
              { label: "Este mes", from: `${bogotaToday().slice(0, 8)}01`, to: bogotaToday() },
            ].map((r) => (
              <Button key={r.label} variant="outline" size="sm" disabled={isPending} onClick={() => pushFilter({ from: r.from, to: r.to })}>
                {r.label}
              </Button>
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

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventas netas</p>
                <p className="text-xl font-bold text-emerald-600">{formatCOP(stats.sales)}</p>
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
                <p className="text-xs text-muted-foreground">Gastos</p>
                <p className="text-xl font-bold text-red-600">{formatCOP(stats.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Wallet className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilidad</p>
                <p className={`text-xl font-bold ${stats.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCOP(stats.profit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pedidos</p>
              <p className="text-xl font-bold">{stats.ordersCount} <span className="text-xs font-normal text-muted-foreground">válidos</span></p>
              {stats.cancelledCount > 0 && (
                <p className="text-xs text-destructive">{stats.cancelledCount} cancelados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por pago */}
      {Object.keys(stats.byMethod).length > 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium">Ventas por método de pago</p>
            <div className="flex gap-4">
              {Object.entries(stats.byMethod).map(([method, total]) => (
                <Badge key={method} variant="secondary" className="gap-1 px-3 py-1 text-sm">
                  {method === "EFECTIVO" ? "💵" : "🏦"} {method}: {formatCOP(total)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Pedidos del período */}
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <p className="mb-3 text-sm font-medium">Pedidos del período ({orders.length})</p>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos en este período</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="pb-2 pr-2 font-medium">Fecha</th>
                  <th className="pb-2 pr-2 font-medium">Cliente</th>
                  <th className="pb-2 pr-2 font-medium">Estado</th>
                  <th className="pb-2 pr-2 font-medium">Pago</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-bold text-muted-foreground">#{o.order_number}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td className="py-2 pr-2">{o.customer_name || "—"}</td>
                    <td className="py-2 pr-2"><Badge variant="outline" className="text-[10px]">{o.status}</Badge></td>
                    <td className="py-2 pr-2 text-xs">{o.payment_method ?? "EFECTIVO"}</td>
                    <td className="py-2 text-right font-semibold">{formatCOP(Number(o.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
