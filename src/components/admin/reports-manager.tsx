"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Package, ReceiptText, Search, ShoppingCart } from "lucide-react";
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
  subtotal: number;
  delivery_fee: number;
  delivery_fee_retained: boolean;
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

interface ProductionRow {
  id: string;
  record_date: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  item?: { name: string } | null;
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
  production,
  filters,
  categories,
}: {
  orders: OrderRow[];
  expenses: ExpenseRow[];
  production: ProductionRow[];
  filters: Filters;
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELADO");
    const subtotalSales = validOrders.reduce((s, o) => s + Number(o.subtotal), 0);
    const sales = subtotalSales;
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const prodTotal = production.reduce((s, p) => s + Number(p.total_cost), 0);
    return {
      validOrdersCount: validOrders.length,
      sales,
      expenses: expTotal,
      production: prodTotal,
    };
  }, [orders, expenses, production]);

  // El historial solo muestra pedidos no cancelados (los cancelados no aparecen
  // ni se suman).
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "CANCELADO"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeOrders;
    const num = q.replace(/^#/, "");
    const numOnly = /^\d+$/.test(num);
    return activeOrders.filter((o) => {
      const byNumber =
        numOnly && String(o.order_number).toLowerCase().includes(num);
      const byName = (o.customer_name || "").toLowerCase().includes(q);
      return byNumber || byName;
    });
  }, [activeOrders, search]);

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
        </CardContent>
      </Card>

      {/* KPIs: sumas de cada historial */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingCart className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventas (productos, sin domis)</p>
                <p className="text-xl font-bold text-emerald-600">{formatCOP(stats.sales)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {stats.validOrdersCount} pedidos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
                <ReceiptText className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gastos (suma)</p>
                <p className="text-xl font-bold text-red-600">{formatCOP(stats.expenses)}</p>
                <p className="text-[10px] text-muted-foreground">{expenses.length} registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Package className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compras materia prima (suma)</p>
                <p className="text-xl font-bold text-amber-600">{formatCOP(stats.production)}</p>
                <p className="text-[10px] text-muted-foreground">{production.length} registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de pedidos */}
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Historial de pedidos ({orders.length})</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por # pedido o nombre del cliente…"
                  className="h-8 w-64 pl-8"
                />
              </div>
              <a href={`/admin/export/pedidos?${exportParams}`}>
                <Button variant="outline" size="sm">
                  <Download className="size-4" />
                  CSV
                </Button>
              </a>
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos en este período</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin resultados para “{search.trim()}”
            </p>
          ) : (
            <>
              {search.trim() ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  {filteredOrders.length} de {orders.length} pedidos
                </p>
              ) : null}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Fecha</th>
                    <th className="pb-2 pr-2 font-medium">Cliente</th>
                    <th className="pb-2 pr-2 font-medium">Estado</th>
                    <th className="pb-2 pr-2 font-medium">Pago</th>
                    <th className="pb-2 pr-2 text-right font-medium">Subtotal</th>
                    <th className="pb-2 text-right font-medium">Total (sin domis)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-bold text-muted-foreground">#{o.order_number}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDate(o.created_at)}</td>
                      <td className="py-2 pr-2">{o.customer_name || "—"}</td>
                      <td className="py-2 pr-2"><Badge variant="outline" className="text-[10px]">{o.status}</Badge></td>
                      <td className="py-2 pr-2 text-xs">{o.payment_method ?? "EFECTIVO"}</td>
                      <td className="py-2 pr-2 text-right">{formatCOP(Number(o.subtotal))}</td>
                      <td className="py-2 text-right font-semibold">{formatCOP(Number(o.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="mt-2 w-full text-sm">
                <tfoot>
                  <tr className="border-t font-bold">
                    <td colSpan={6} className="py-2 text-right">Total</td>
                    <td className="py-2 text-right">{formatCOP(stats.sales)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Historial de gastos */}
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Historial de gastos ({expenses.length})</p>
            <a href={`/admin/export/expenses?${exportParams}`}>
              <Button variant="outline" size="sm">
                <Download className="size-4" />
                CSV
              </Button>
            </a>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos en este período</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Fecha</th>
                  <th className="pb-2 pr-2 font-medium">Categoría</th>
                  <th className="pb-2 pr-2 font-medium">Concepto</th>
                  <th className="pb-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap">{e.expense_date}</td>
                    <td className="py-2 pr-2"><Badge variant="outline" className="text-[10px]">{e.category_name ?? "—"}</Badge></td>
                    <td className="py-2 pr-2 text-muted-foreground">{e.concept}</td>
                    <td className="py-2 text-right font-semibold text-red-600">{formatCOP(Number(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={3} className="py-2 pr-2 text-right">Total gastos</td>
                  <td className="py-2 text-right text-red-600">{formatCOP(stats.expenses)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Historial de compras */}
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Historial de compras ({production.length})</p>
            <a href={`/admin/export/produccion?from=${filters.from}&to=${filters.to}`}>
              <Button variant="outline" size="sm">
                <Download className="size-4" />
                CSV
              </Button>
            </a>
          </div>
          {production.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin compras en este período</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Fecha</th>
                  <th className="pb-2 pr-2 font-medium">Insumo</th>
                  <th className="pb-2 pr-2 font-medium">Descripción</th>
                  <th className="pb-2 pr-2 text-right font-medium">Cantidad</th>
                  <th className="pb-2 pr-2 text-right font-medium">Costo/ud</th>
                  <th className="pb-2 text-right font-medium">Costo total</th>
                </tr>
              </thead>
              <tbody>
                {production.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap">{p.record_date}</td>
                    <td className="py-2 pr-2">{p.item?.name ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{p.description || "—"}</td>
                    <td className="py-2 pr-2 text-right">{p.quantity} {p.unit}</td>
                    <td className="py-2 pr-2 text-right text-muted-foreground">{formatCOP(p.unit_cost)}</td>
                    <td className="py-2 text-right font-semibold text-amber-600">{formatCOP(p.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={5} className="py-2 pr-2 text-right">Total compras</td>
                  <td className="py-2 text-right text-amber-600">{formatCOP(stats.production)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
