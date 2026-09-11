"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Drumstick, Flame, Hamburger, Package, ReceiptText, Search, ShoppingCart, Trophy } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { SalesStats } from "@/lib/sales-counting";
import { KpiCard } from "@/components/admin/kpi-card";

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
  sales,
}: {
  orders: OrderRow[];
  expenses: ExpenseRow[];
  production: ProductionRow[];
  filters: Filters;
  categories: { id: number; name: string }[];
  sales: SalesStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [ventasTipo, setVentasTipo] = useState<"todos" | "hamburguesas" | "perros">("todos");

  const ranking = useMemo(() => {
    const hits = [...sales.byProduct];
    if (ventasTipo === "hamburguesas") {
      return hits.filter((h) => h.hamburguesas > 0).sort((a, b) => b.hamburguesas - a.hamburguesas);
    }
    if (ventasTipo === "perros") {
      return hits.filter((h) => h.perros > 0).sort((a, b) => b.perros - a.perros);
    }
    return hits;
  }, [sales.byProduct, ventasTipo]);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ShoppingCart}
          label="Ventas (productos, sin domis)"
          value={formatCOP(stats.sales)}
          valueClassName="text-xl text-emerald-600"
          caption={`${stats.validOrdersCount} pedidos`}
          help={{
            what: "Subtotal de los pedidos no cancelados del período. Excluye el valor de los domicilios.",
            formula: "Σ subtotal · pedidos ≠ CANCELADO",
          }}
        />
        <KpiCard
          icon={ReceiptText}
          tileClassName="bg-red-500/10"
          iconClassName="text-red-600"
          label="Gastos (suma)"
          value={formatCOP(stats.expenses)}
          valueClassName="text-xl text-red-600"
          caption={`${expenses.length} registros`}
          help={{
            what: "Suma de todos los gastos registrados en el período, sin importar la categoría.",
            formula: "Σ monto · fecha en el filtro",
          }}
        />
        <KpiCard
          icon={Package}
          tileClassName="bg-amber-500/10"
          iconClassName="text-amber-600"
          label="Compras materia prima (suma)"
          value={formatCOP(stats.production)}
          valueClassName="text-xl text-amber-600"
          caption={`${production.length} registros`}
          help={{
            what: "Suma de las compras de materia prima registradas en Producción dentro del período.",
            formula: "Σ total_cost · fecha en el filtro",
          }}
        />
        <KpiCard
          icon={Flame}
          tileClassName="bg-orange-500/10"
          iconClassName="text-orange-600"
          label="Unidades vendidas"
          value={
            <>
              <span className="text-orange-600">{sales.totals.pedidos}</span>
              <span className="text-sm font-normal text-muted-foreground"> pedidos</span>
            </>
          }
          valueClassName="text-xl"
          caption={
            <span className="inline-flex items-center gap-1.5">
              🍔 {sales.totals.hamburguesas}
              <hr />
              🌭 {sales.totals.perros}
            </span>
          }
          help={{
            what: "Conteos registrados en los productos (ingresados al confirmar el pedido o manualmente en Productos).",
            formula: "Σ conteo_hamburguesas + conteo_perros",
            suggestion: "El conteo se registra automáticamente al confirmar el pedido; también puedes ajustarlo en la columna de conteo de cada producto.",
          }}
        />
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
                    <th className="pb-2 pr-2 font-medium">🍔/🌭</th>
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
                      <td className="py-2 pr-2 text-xs whitespace-nowrap">
                        {(() => {
                          const c = sales.perOrder[o.id];
                          if (!c) return "—";
                          return `${c.hamburguesas} 🍔 · ${c.perros} 🌭`;
                        })()}
                      </td>
                      <td className="py-2 pr-2 text-right">{formatCOP(Number(o.subtotal))}</td>
                      <td className="py-2 text-right font-semibold">{formatCOP(Number(o.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="mt-2 w-full text-sm">
                <tfoot>
                  <tr className="border-t font-bold">
                    <td colSpan={7} className="py-2 text-right">Total</td>
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
      {/* Más vendidos */}
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              <p className="text-sm font-medium">Más vendidos</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={ventasTipo} onValueChange={(v) => setVentasTipo(v as typeof ventasTipo)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hamburguesas">Hamburguesas</SelectItem>
                  <SelectItem value="perros">Perros</SelectItem>
                </SelectContent>
              </Select>
              <a href={`/admin/export/mas-vendidos?${exportParams}&tipo=${ventasTipo}`}>
                <Button variant="outline" size="sm">
                  <Download className="size-4" />
                  CSV
                </Button>
              </a>
            </div>
          </div>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ventas en este período</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="pb-2 pr-2 font-medium">Producto</th>
                  <th className="pb-2 pr-2 text-right font-medium">Unidades</th>
                  <th className="pb-2 pr-2 text-right font-medium">🍔</th>
                  <th className="pb-2 pr-2 text-right font-medium">🌭</th>
                  <th className="pb-2 text-right font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, 15).map((h, i) => (
                  <tr key={h.name} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium">{h.name}</td>
                    <td className="py-2 pr-2 text-right">{h.units}</td>
                    <td className="py-2 pr-2 text-right">{h.hamburguesas || "—"}</td>
                    <td className="py-2 pr-2 text-right">{h.perros || "—"}</td>
                    <td className="py-2 text-right font-semibold">{formatCOP(h.ingresos)}</td>
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
