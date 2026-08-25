"use client";

import Link from "next/link";
import {
  Banknote,
  Clock,
  CreditCard,
  DollarSign,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { formatCOP } from "@/lib/format";
import type { OpenStatus } from "@/lib/business-hours";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export function DashboardStats({
  status,
  today,
  recentOrders,
  lowStock,
}: {
  status: OpenStatus;
  today: {
    ordersCount: number;
    totalSales: number;
    totalExpenses: number;
    profit: number;
    ordersByStatus: Record<string, number>;
    paymentsByMethod: Record<string, number>;
  };
  recentOrders: {
    id: string;
    order_number: number;
    status: string;
    customer_name: string;
    total: number;
    payment_method: string | null;
    origin: string;
    created_at: string;
  }[];
  lowStock: { id: string; name: string; current_stock: number; min_stock: number; unit: string }[];
}) {
  return (
    <div className="space-y-6">
      {/* Estado del negocio */}
      <Card className={status.isOpen ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}>
        <CardContent className="flex items-center gap-3 py-3">
          <div className={`flex size-10 items-center justify-center rounded-full ${status.isOpen ? "bg-emerald-500" : "bg-red-500"}`}>
            <Clock className="size-5 text-white" />
          </div>
          <div>
            <p className="font-bold">{status.isOpen ? "ABIERTO" : "CERRADO"}</p>
            <p className="text-sm text-muted-foreground">{status.message}</p>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingCart className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos hoy</p>
                <p className="text-2xl font-bold">{today.ordersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventas hoy</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCOP(today.totalSales)}</p>
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
                <p className="text-xs text-muted-foreground">Gastos hoy</p>
                <p className="text-2xl font-bold text-red-600">{formatCOP(today.totalExpenses)}</p>
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
                <p className="text-xs text-muted-foreground">Utilidad estimada</p>
                <p className={`text-2xl font-bold ${today.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCOP(today.profit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Por estado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pedidos por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(today.ordersByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos hoy</p>
            ) : (
              Object.entries(today.ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm">{STATUS_LABELS[status] ?? status}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Por medio de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pedidos por pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(today.paymentsByMethod).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos hoy</p>
            ) : (
              Object.entries(today.paymentsByMethod).map(([method, count]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    {method === "EFECTIVO" ? (
                      <Banknote className="size-4 text-emerald-600" />
                    ) : (
                      <CreditCard className="size-4 text-blue-600" />
                    )}
                    {method === "EFECTIVO" ? "Efectivo" : "Transferencia"}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="size-4" />
              Stock bajo ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.name}</span>
                <span className="font-medium text-amber-700">
                  {item.current_stock} / {item.min_stock} {item.unit}
                </span>
              </div>
            ))}
            <Link href="/admin/inventario" className="block pt-1 text-xs font-medium text-primary hover:underline">
              Ver inventario →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* Pedidos recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pedidos recientes de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos hoy</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground">#{o.order_number}</span>
                    <span className="text-sm font-medium">{o.customer_name || "—"}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {o.origin}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-[10px]">
                      {STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                    <span className="text-sm font-semibold">{formatCOP(Number(o.total))}</span>
                  </div>
                </div>
              ))}
              <Link href="/admin/pedidos" className="block pt-1 text-xs font-medium text-primary hover:underline">
                Ver todos los pedidos →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
