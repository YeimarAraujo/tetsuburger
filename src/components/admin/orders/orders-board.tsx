"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Banknote,
  CheckCheck,
  Clock,
  Landmark,
  RefreshCw,
  Store,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { playNewOrderSound } from "@/lib/sound";
import { updateOrderStatus } from "@/features/orders/board-actions";
import {
  ACTIVE_STATUSES,
  NEXT_STATUS,
  ORDER_STATUS_META,
} from "@/lib/order-status";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderItemAddon, OrderStatus } from "@/types/db";
import { Button } from "@/components/ui/button";

export interface BoardOrder {
  id: string;
  order_number: number;
  origin: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_type: string;
  payment_method: string;
  delivery_fee: number;
  subtotal: number;
  total: number;
  notes: string;
  created_at: string;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    order_item_addons: OrderItemAddon[];
  }[];
}

const BOARD_COLUMNS: OrderStatus[] = [
  "PENDIENTE",
  "CONFIRMADO",
  "EN_PREPARACION",
  "LISTO",
  "EN_CAMINO",
];

const MINS_WARNING = 15;

function elapsedMinutes(createdAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 60000));
}

async function fetchOrderDetail(
  supabase: ReturnType<typeof createClient>,
  orderId: string
): Promise<BoardOrder | null> {
  const { data } = await supabase
    .from("orders")
    .select("*, items:order_items(*, order_item_addons(*))")
    .eq("id", orderId)
    .single();

  return (data as unknown as BoardOrder) ?? null;
}

export function OrdersBoard({ initialOrders }: { initialOrders: BoardOrder[] }) {
  const [orders, setOrders] = useState<BoardOrder[]>(initialOrders);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BoardOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
    localStorage.setItem("tetsu-board-muted", String(muted));
  }, [muted]);

  useEffect(() => {
    setMuted(localStorage.getItem("tetsu-board-muted") === "true");
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const upsertOrder = useCallback((order: BoardOrder) => {
    setOrders((prev) => {
      const isActive = ACTIVE_STATUSES.includes(order.status);
      const rest = prev.filter((o) => o.id !== order.id);
      return isActive ? [...rest, order].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ) : rest;
    });
  }, []);

  // ---- Suscripción Realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("orders-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const detail = await fetchOrderDetail(supabase, payload.new.id);
            if (!detail) return;
            upsertOrder(detail);

            if (detail.status === "PENDIENTE" && !mutedRef.current) {
              playNewOrderSound();
              toast.success(
                `🔔 Nuevo pedido ${formatOrderNumber(detail.order_number)} · ${formatCOP(Number(detail.total))}`
              );
            }
          }

          if (payload.eventType === "UPDATE") {
            const detail = await fetchOrderDetail(supabase, payload.new.id);
            if (!detail) return;
            upsertOrder(detail);

            if (
              mutedRef.current === false &&
              detail.status !== (payload.old as { status?: OrderStatus }).status
            ) {
              toast.info(
                `Pedido ${formatOrderNumber(detail.order_number)} → ${ORDER_STATUS_META[detail.status].label}`
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [upsertOrder]);

  async function refreshAll() {
    setRefreshing(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, items:order_items(*, order_item_addons(*))")
      .in("status", ACTIVE_STATUSES)
      .order("created_at");

    setOrders(((data ?? []) as unknown as BoardOrder[]).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    ));
    setRefreshing(false);
  }

  async function handleAdvance(order: BoardOrder, next: OrderStatus) {
    const result = await updateOrderStatus(order.id, next);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Pedido ${formatOrderNumber(order.order_number)} → ${ORDER_STATUS_META[next].label}`
    );
    // El realtime actualiza la tarjeta; refresco optimista:
    upsertOrder({ ...order, status: next });
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    const result = await updateOrderStatus(cancelTarget.id, "CANCELADO", cancelReason);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Pedido ${formatOrderNumber(cancelTarget.order_number)} cancelado`);
    setCancelTarget(null);
    setCancelReason("");
  }

  const counts = useMemo(() => {
    const map = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, 0])) as Record<OrderStatus, number>;
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          En vivo
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <BellOff className="size-4" /> : <Bell className="size-4 text-primary" />}
            {muted ? "Sonido off" : "Sonido on"}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Conteo por columna */}
      <div className="flex flex-wrap gap-2">
        {BOARD_COLUMNS.map((status) => (
          <span
            key={status}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              ORDER_STATUS_META[status].badgeClass
            )}
          >
            {ORDER_STATUS_META[status].label}: {counts[status]}
          </span>
        ))}
      </div>

      {/* Columnas */}
      <div className="grid gap-3 lg:grid-cols-5">
        {BOARD_COLUMNS.map((status) => {
          const colOrders = orders.filter((o) => o.status === status);
          const meta = ORDER_STATUS_META[status];
          const next = NEXT_STATUS[status];

          return (
            <section key={status} className="min-w-0 space-y-2">
              <h2
                className={cn(
                  "sticky top-14 z-10 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
                  meta.badgeClass
                )}
              >
                {meta.label} ({colOrders.length})
              </h2>

              {colOrders.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Sin pedidos
                </p>
              ) : (
                colOrders.map((order) => {
                  const mins = elapsedMinutes(order.created_at, now);
                  const late = mins >= MINS_WARNING;

                  return (
                    <article
                      key={order.id}
                      className={cn(
                        "space-y-2 rounded-lg border bg-card p-3 text-sm shadow-sm",
                        late && status === "PENDIENTE" && "border-red-300 ring-1 ring-red-200"
                      )}
                    >
                      <header className="flex items-center justify-between gap-2">
                        <span className="font-extrabold">
                          {formatOrderNumber(order.order_number)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                            order.origin === "WEB"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {order.origin === "WEB" ? <Store className="size-3" /> : null}
                          {order.origin}
                        </span>
                      </header>

                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
                          {order.payment_method === "TRANSFERENCIA" ? (
                            <>
                              <Landmark className="size-3" /> Transferencia
                            </>
                          ) : (
                            <>
                              <Banknote className="size-3" /> Efectivo
                            </>
                          )}
                        </span>
                        <span className={cn("flex items-center gap-1 text-xs", late ? "font-bold text-red-500" : "text-muted-foreground")}>
                          <Clock className="size-3" />
                          hace {mins} min{late ? " ⚠️" : ""}
                        </span>
                      </div>

                      {order.delivery_type === "DOMICILIO" ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          order.delivery_fee > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        )}>
                          <Truck className="size-3" />
                          {order.delivery_fee > 0 ? `Domicilio: ${formatCOP(order.delivery_fee)}` : "Sin cargo domicilio"}
                        </span>
                      ) : null}

                      <div className="space-y-0.5 rounded-md bg-muted/60 p-2">
                        <p className="font-semibold">{order.customer_name}</p>
                        <p className="truncate text-xs text-muted-foreground" title={order.customer_phone}>
                          📞 {order.customer_phone}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={order.customer_address}>
                          📍 {order.customer_address}
                        </p>
                      </div>

                      <ul className="space-y-1 text-xs">
                        {order.items?.map((item) => (
                          <li key={item.id}>
                            <span className="font-bold">{item.quantity}×</span>{" "}
                            {item.product_name}
                            {item.order_item_addons?.length > 0 ? (
                              <span className="block pl-4 text-[11px] text-muted-foreground">
                                + {item.order_item_addons.map((a) => a.addon_name).join(", ")}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      {order.notes ? (
                        <p className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-[11px] italic text-amber-800">
                          “{order.notes}”
                        </p>
                      ) : null}

                      <footer className="flex items-center justify-between gap-2 pt-1">
                        <span className="font-bold">{formatCOP(Number(order.total))}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCancelTarget(order)}
                            className="rounded-md border p-1.5 text-destructive hover:bg-red-50"
                            title="Cancelar pedido"
                          >
                            <X className="size-3.5" />
                          </button>
                          {next ? (
                            <Button size="sm" onClick={() => handleAdvance(order, next)}>
                              <CheckCheck className="size-3.5" />
                              {ORDER_STATUS_META[next].label}
                            </Button>
                          ) : null}
                        </div>
                      </footer>
                    </article>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      {/* Cancelar con motivo */}
      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-background p-5 shadow-lg">
            <h3 className="font-bold">
              Cancelar pedido {formatOrderNumber(cancelTarget.order_number)}
            </h3>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo (obligatorio): cliente canceló, dirección incorrecta…"
              rows={3}
              maxLength={200}
              className="w-full rounded-md border bg-transparent p-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
