"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Bell,
  BellOff,
  Banknote,
  Clock,
  Landmark,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { playNewOrderSound } from "@/lib/sound";
import {
  addOrderItem,
  setBoardMuted,
  setDeliveryRetained,
  undoOrderStatus,
  updateOrderStatus,
  updateOrderTotals,
} from "@/features/orders/board-actions";
import {
  getOrderConsumptionBreakdown,
  saveOrderConsumptionOverrides,
  type ConsumptionBreakDownItem,
} from "@/features/orders/consumption-actions";
import {
  ACTIVE_STATUSES,
  ORDER_STATUS_META,
  nextStatusFor,
} from "@/lib/order-status";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { addonCharged, addonLabel } from "@/lib/addons";
import { cn } from "@/lib/utils";
import type { OrderItemAddon, OrderStatus } from "@/types/db";
import type { ManualProduct } from "@/components/admin/orders/manual-order-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  delivery_fee_retained: boolean;
  subtotal: number;
  final_adjustment: number;
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

/** Texto del botón principal según el estado al que pasa el pedido. */
const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMADO: "Confirmar",
  EN_PREPARACION: "A cocina",
  LISTO: "Marcar listo",
  EN_CAMINO: "Despachar",
  ENTREGADO: "Entregar",
};

const DELIVERY_LABEL: Record<string, string> = {
  DOMICILIO: "Domicilio",
  RECOGIDA: "Recoge",
  LOCAL: "En el local",
};

const MINS_WARNING = 15;

type LiveStatus = "connecting" | "live" | "offline";

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

export function OrdersBoard({
  initialOrders,
  deliveryFeeBusiness = 0,
  products = [],
  initialMuted = false,
}: {
  initialOrders: BoardOrder[];
  deliveryFeeBusiness?: number;
  products?: ManualProduct[];
  initialMuted?: boolean;
}) {
  const [orders, setOrders] = useState<BoardOrder[]>(initialOrders);
  const [muted, setMuted] = useState(initialMuted);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [mobileStatus, setMobileStatus] = useState<OrderStatus>(
    () => BOARD_COLUMNS.find((s) => initialOrders.some((o) => o.status === s)) ?? "PENDIENTE"
  );
  const [cancelTarget, setCancelTarget] = useState<BoardOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [chargeTarget, setChargeTarget] = useState<BoardOrder | null>(null);
  const [consumptionTarget, setConsumptionTarget] = useState<BoardOrder | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<BoardOrder | null>(null);
  const [addItemSearch, setAddItemSearch] = useState("");
  const [addItemProduct, setAddItemProduct] = useState<ManualProduct | null>(null);
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemAddons, setAddItemAddons] = useState<Record<string, number>>({});
  const [addingItem, setAddingItem] = useState(false);
  const mutedRef = useRef(initialMuted);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    void setBoardMuted(next);
  }

  const upsertOrder = useCallback((order: BoardOrder) => {
    setOrders((prev) => {
      const isActive = ACTIVE_STATUSES.includes(order.status);
      const rest = prev.filter((o) => o.id !== order.id);
      return isActive ? [...rest, order].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ) : rest;
    });
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*, order_item_addons(*))")
      .in("status", ACTIVE_STATUSES)
      .order("created_at");

    if (error) {
      toast.error("No se pudieron cargar los pedidos. Revisa tu conexión.");
    } else {
      setOrders(((data ?? []) as unknown as BoardOrder[]).sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ));
    }
    setRefreshing(false);
  }, []);

  // ---- Suscripción Realtime
  useEffect(() => {
    const supabase = createClient();
    let wasOffline = false;

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
                `Nuevo pedido ${formatOrderNumber(detail.order_number)} · ${formatCOP(Number(detail.total))}`
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLiveStatus("live");
          // Tras una caída se recargan los pedidos que llegaron sin conexión.
          if (wasOffline) void refreshAll();
          wasOffline = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLiveStatus("offline");
          wasOffline = true;
        }
      });

    // Al volver a la pestaña (móvil bloqueado, otra app) se sincroniza.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [upsertOrder, refreshAll]);

  /** Ejecuta una acción sobre un pedido bloqueando sus botones mientras dura. */
  async function withPending(orderId: string, action: () => Promise<void>) {
    // El ref corta el segundo clic aunque llegue antes del re-render.
    if (pendingRef.current.has(orderId)) return;
    pendingRef.current.add(orderId);
    setPendingIds((prev) => new Set(prev).add(orderId));
    try {
      await action();
    } finally {
      pendingRef.current.delete(orderId);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }

  function handleAdvance(order: BoardOrder, next: OrderStatus) {
    return withPending(order.id, async () => {
      const result = await updateOrderStatus(order.id, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Pedido ${formatOrderNumber(order.order_number)} → ${ORDER_STATUS_META[next].label}`,
        undoToastOptions(order)
      );
      // Re-consulta el pedido tras el cambio para no pisar valores (ej. delivery_fee_retained)
      // desde un cierre desactualizado de la tarjeta.
      const supabase = createClient();
      const detail = await fetchOrderDetail(supabase, order.id);
      if (detail) upsertOrder(detail);
      else upsertOrder({ ...order, status: next });
    });
  }

  /** Aviso con botón "Deshacer" (el servidor lo acepta durante 2 minutos). */
  function undoToastOptions(order: BoardOrder) {
    return {
      duration: 20_000,
      action: {
        label: "Deshacer",
        onClick: () => void handleUndo(order),
      },
    };
  }

  function handleUndo(order: BoardOrder) {
    return withPending(order.id, async () => {
      const result = await undoOrderStatus(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const supabase = createClient();
      const detail = await fetchOrderDetail(supabase, order.id);
      if (detail) upsertOrder(detail);
      toast.info(
        `Pedido ${formatOrderNumber(order.order_number)} volvió a ${
          result.status ? ORDER_STATUS_META[result.status].label : "su estado anterior"
        }`
      );
    });
  }

  function handleCancel() {
    const target = cancelTarget;
    if (!target) return;
    return withPending(target.id, async () => {
      const result = await updateOrderStatus(target.id, "CANCELADO", cancelReason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Pedido ${formatOrderNumber(target.order_number)} cancelado`,
        undoToastOptions(target)
      );
      upsertOrder({ ...target, status: "CANCELADO" });
      setCancelTarget(null);
      setCancelReason("");
    });
  }

  function toggleDeliveryRetained(order: BoardOrder) {
    return withPending(order.id, async () => {
      const newValue = !order.delivery_fee_retained;
      const result = await setDeliveryRetained(order.id, newValue);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      upsertOrder({ ...order, delivery_fee_retained: newValue });
      toast.success(
        newValue
          ? "Domicilio ahora retenido por la empresa"
          : "Domicilio marcado como repartidor externo"
      );
    });
  }

  function addItemCost(): number {
    if (!addItemProduct) return 0;
    const addonSum = addItemProduct.addons.reduce(
      (s, a) => s + addonCharged({ ...a, quantity: addItemAddons[a.id] ?? 0 }),
      0
    );
    return (Number(addItemProduct.price) + addonSum) * addItemQty;
  }

  function openAddItem(order: BoardOrder) {
    setAddItemTarget(order);
    setAddItemSearch("");
    setAddItemProduct(null);
    setAddItemQty(1);
    setAddItemAddons({});
  }

  async function confirmAddItem() {
    if (!addItemTarget || !addItemProduct || addingItem) return;
    setAddingItem(true);

    const result = await addOrderItem(
      addItemTarget.id,
      [
        {
          product_id: addItemProduct.id,
          quantity: addItemQty,
          addons: addItemProduct.addons
            .filter((a) => (addItemAddons[a.id] ?? 0) > 0)
            .map((a) => ({
              addon_id: a.id,
              quantity: addItemAddons[a.id] ?? 1,
            })),
        },
      ]
    );

    setAddingItem(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Producto agregado al pedido");
    setAddItemTarget(null);
    setAddItemProduct(null);
    setAddItemAddons({});
    await refreshAll();
  }

  const filteredAddItems = useMemo(() => {
    const q = addItemSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, addItemSearch]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, 0])) as Record<OrderStatus, number>;
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  const liveMeta = {
    connecting: { label: "Conectando…", dot: "bg-amber-500 animate-pulse", text: "text-muted-foreground" },
    live: { label: "En vivo", dot: "bg-emerald-500 animate-pulse", text: "text-muted-foreground" },
    offline: { label: "Sin conexión en vivo: refresca para ver pedidos nuevos", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  }[liveStatus];

  return (
    <div className="space-y-4">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          role="status"
          className={cn("flex items-center gap-1.5 text-xs font-medium", liveMeta.text)}
        >
          <span className={cn("size-2 rounded-full", liveMeta.dot)} />
          {liveMeta.label}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={toggleMuted}
            aria-pressed={!muted}
            title={muted ? "Activar sonido de pedidos nuevos" : "Silenciar pedidos nuevos"}
          >
            {muted ? <BellOff className="size-4" /> : <Bell className="size-4 text-primary" />}
            <span className="hidden sm:inline">{muted ? "Sonido apagado" : "Sonido activo"}</span>
          </Button>
          <Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refrescar</span>
          </Button>
        </div>
      </div>

      {/* Selector de estado (móvil y tableta): una columna a la vez */}
      <div
        role="tablist"
        aria-label="Estado de los pedidos"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {BOARD_COLUMNS.map((status) => {
          const active = status === mobileStatus;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMobileStatus(status)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                active ? ORDER_STATUS_META[status].badgeClass : "bg-background text-muted-foreground"
              )}
            >
              {ORDER_STATUS_META[status].label}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-white/60" : "bg-muted"
                )}
              >
                {counts[status]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Columnas */}
      <div className="grid gap-3 lg:grid-cols-5">
        {BOARD_COLUMNS.map((status) => {
          const colOrders = orders.filter((o) => o.status === status);
          const meta = ORDER_STATUS_META[status];

          return (
            <section
              key={status}
              aria-label={meta.label}
              className={cn("min-w-0 space-y-2", status !== mobileStatus && "hidden lg:block")}
            >
              <h2
                className={cn(
                  "sticky top-14 z-10 hidden rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide lg:block",
                  meta.badgeClass
                )}
              >
                {meta.label} ({colOrders.length})
              </h2>

              {colOrders.length === 0 ? (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Sin pedidos {meta.label.toLowerCase()}
                </p>
              ) : (
                colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    pending={pendingIds.has(order.id)}
                    deliveryFeeBusiness={deliveryFeeBusiness}
                    onAdvance={handleAdvance}
                    onToggleRetained={toggleDeliveryRetained}
                    onEditCharge={setChargeTarget}
                    onAddItem={openAddItem}
                    onConsumption={setConsumptionTarget}
                    onCancel={(o) => {
                      setCancelReason("");
                      setCancelTarget(o);
                    }}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>

      {/* Editar cobro */}
      <ChargeDialog
        key={`cobro-${chargeTarget?.id ?? "cerrado"}`}
        order={chargeTarget}
        onClose={() => setChargeTarget(null)}
        onSaved={(order) => {
          upsertOrder(order);
          setChargeTarget(null);
        }}
      />

      {/* Consumos por pedido */}
      <OrderConsumptionDialog
        key={`insumos-${consumptionTarget?.id ?? "cerrado"}`}
        order={consumptionTarget}
        onOpenChange={(o) => { if (!o) setConsumptionTarget(null); }}
      />

      {/* Agregar producto a pedido */}
      <Dialog open={addItemTarget !== null} onOpenChange={(o) => { if (!o) setAddItemTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Agregar producto {addItemTarget ? `a ${formatOrderNumber(addItemTarget.order_number)}` : ""}
            </DialogTitle>
          </DialogHeader>

          {!addItemProduct ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={addItemSearch}
                  onChange={(e) => setAddItemSearch(e.target.value)}
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                  className="pl-8"
                  autoFocus
                />
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {filteredAddItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados</p>
                ) : (
                  filteredAddItems.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.is_available}
                      onClick={() => {
                        setAddItemProduct(p);
                        setAddItemQty(1);
                        setAddItemAddons({});
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left transition-colors",
                        p.is_available ? "hover:border-primary hover:bg-muted/50" : "cursor-not-allowed opacity-50"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.is_available ? formatCOP(p.price) : "Agotado"}
                        </span>
                      </span>
                      {p.is_available ? <Plus className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{addItemProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCOP(addItemProduct.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddItemProduct(null)}
                  className="text-xs text-muted-foreground underline"
                >
                  Cambiar
                </button>
              </div>

              <div className="space-y-2">
                <Label>Cantidad</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Quitar uno"
                    onClick={() => setAddItemQty((q) => Math.max(1, q - 1))}
                  >
                    −
                  </Button>
                  <span className="w-10 text-center font-bold">{addItemQty}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Agregar uno"
                    onClick={() => setAddItemQty((q) => Math.min(50, q + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              {addItemProduct.addons.length > 0 ? (
                <div className="space-y-2">
                  <Label>Adicionales · cantidad</Label>
                  <div className="space-y-1">
                    {addItemProduct.addons.map((a) => {
                      const qty = addItemAddons[a.id] ?? 0;
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border p-2 text-sm",
                            a.available === false && "opacity-50"
                          )}
                        >
                          <span>
                            {a.name} · {formatCOP(a.price)}
                            {a.available === false ? " (agotado)" : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Quitar ${a.name}`}
                              disabled={a.available === false || qty <= 0}
                              onClick={() =>
                                setAddItemAddons((prev) => {
                                  const next = { ...prev };
                                  if (qty <= 1) delete next[a.id];
                                  else next[a.id] = qty - 1;
                                  return next;
                                })
                              }
                            >
                              −
                            </Button>
                            <span className="w-7 text-center text-sm font-bold">{qty}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Agregar ${a.name}`}
                              disabled={a.available === false || qty >= 10}
                              onClick={() =>
                                setAddItemAddons((prev) => ({ ...prev, [a.id]: qty + 1 }))
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Subtotal del producto</p>
                <p className="text-xl font-bold text-price">{formatCOP(addItemCost())}</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddItemProduct(null)}>
                  Volver
                </Button>
                <Button type="button" onClick={confirmAddItem} disabled={addingItem}>
                  {addingItem ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Agregar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancelar con motivo */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Cancelar pedido {cancelTarget ? formatOrderNumber(cancelTarget.order_number) : ""}
            </DialogTitle>
            <DialogDescription>
              El pedido sale del tablero y queda en el historial como cancelado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo (obligatorio)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Cliente canceló, dirección incorrecta…"
              rows={3}
              maxLength={200}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleCancel()}
              disabled={
                cancelReason.trim().length < 3 ||
                (cancelTarget !== null && pendingIds.has(cancelTarget.id))
              }
            >
              {cancelTarget && pendingIds.has(cancelTarget.id) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Cancelar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- Tarjeta --------------------------------- */

function OrderCard({
  order,
  now,
  pending,
  deliveryFeeBusiness,
  onAdvance,
  onToggleRetained,
  onEditCharge,
  onAddItem,
  onConsumption,
  onCancel,
}: {
  order: BoardOrder;
  now: number;
  pending: boolean;
  deliveryFeeBusiness: number;
  onAdvance: (order: BoardOrder, next: OrderStatus) => void;
  onToggleRetained: (order: BoardOrder) => void;
  onEditCharge: (order: BoardOrder) => void;
  onAddItem: (order: BoardOrder) => void;
  onConsumption: (order: BoardOrder) => void;
  onCancel: (order: BoardOrder) => void;
}) {
  const mins = elapsedMinutes(order.created_at, now);
  const late = mins >= MINS_WARNING;
  const next = nextStatusFor(order.status, order.delivery_type);
  const isDelivery = order.delivery_type === "DOMICILIO";
  const canAddItems = order.status === "PENDIENTE" || order.status === "CONFIRMADO";
  const hasAdjustment = Number(order.final_adjustment ?? 0) !== 0;
  const phoneHref = order.customer_phone ? `tel:${order.customer_phone.replace(/[^0-9+]/g, "")}` : null;

  return (
    <article
      aria-busy={pending}
      className={cn(
        "space-y-2.5 rounded-lg border bg-card p-3 text-sm shadow-sm",
        late && order.status === "PENDIENTE" && "border-red-300 ring-1 ring-red-200 dark:border-red-500/60 dark:ring-red-500/30"
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="text-base font-extrabold">{formatOrderNumber(order.order_number)}</span>
        <span className={cn("flex items-center gap-1 text-xs", late ? "font-bold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
          {late ? <TriangleAlert className="size-3.5" /> : <Clock className="size-3.5" />}
          hace {mins} min
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
            order.origin === "WEB"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
              : "bg-muted text-muted-foreground"
          )}
        >
          {order.origin === "WEB" ? <Store className="size-3" /> : null}
          {order.origin === "WEB" ? "Web" : "Manual"}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
          {isDelivery ? <Truck className="size-3" /> : null}
          {DELIVERY_LABEL[order.delivery_type] ?? order.delivery_type}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
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
      </div>

      <div className="space-y-0.5 rounded-md bg-muted/60 p-2">
        <p className="font-semibold">{order.customer_name}</p>
        {phoneHref ? (
          <a
            href={phoneHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <Phone className="size-3" />
            {order.customer_phone}
          </a>
        ) : null}
        {order.customer_address ? (
          <p className="text-xs text-muted-foreground">{order.customer_address}</p>
        ) : null}
      </div>

      <ul className="space-y-1 text-[13px]">
        {order.items?.map((item) => (
          <li key={item.id}>
            <span className="font-bold">{item.quantity}×</span>{" "}
            {item.product_name}
            {item.order_item_addons?.length > 0 ? (
              <span className="block pl-4 text-xs text-muted-foreground">
                +{" "}
                {item.order_item_addons
                  .map((a) =>
                    addonLabel({
                      id: a.addon_id ?? a.addon_name,
                      name: a.addon_name,
                      price: a.addon_price,
                      quantity: a.quantity,
                      target: a.target as "EACH" | "HAMBURGUESA" | "PERRO" | undefined,
                    })
                  )
                  .join(", ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-xs italic text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          “{order.notes}”
        </p>
      ) : null}

      {/* Cobro */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums">{formatCOP(Number(order.total))}</span>
            {hasAdjustment ? (
              <span
                className="rounded bg-amber-100 px-1 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                title={`Valor final editado (ajuste de ${formatCOP(Number(order.final_adjustment))}). Solo aplica en la web, no se envía a WhatsApp.`}
              >
                Ajustado
              </span>
            ) : null}
          </p>
          {isDelivery ? (
            <p className="text-xs text-muted-foreground">
              {Number(order.delivery_fee) > 0
                ? `Incluye domicilio ${formatCOP(Number(order.delivery_fee))}`
                : "Sin cargo de domicilio"}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEditCharge(order)}
          disabled={pending}
        >
          <Pencil className="size-3.5" />
          Editar cobro
        </Button>
      </div>

      {isDelivery && Number(order.delivery_fee) > 0 ? (
        <button
          type="button"
          onClick={() => onToggleRetained(order)}
          disabled={pending}
          aria-pressed={order.delivery_fee_retained}
          className={cn(
            "flex min-h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-60",
            order.delivery_fee_retained
              ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
          title="Cambiar quién cobra el domicilio"
        >
          <Truck className="size-3.5" />
          {order.delivery_fee_retained
            ? `Domicilio retenido por la empresa: ${formatCOP(deliveryFeeBusiness)}`
            : "Domicilio de repartidor externo"}
        </button>
      ) : null}

      {/* Acciones */}
      <footer className="flex items-center gap-1.5 pt-1">
        {canAddItems ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onAddItem(order)}
            disabled={pending}
            aria-label="Agregar producto a este pedido"
            title="Agregar producto"
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onConsumption(order)}
          disabled={pending}
          aria-label="Ajustar insumos de este pedido"
          title="Ajustar insumos"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onCancel(order)}
          disabled={pending}
          aria-label="Cancelar pedido"
          title="Cancelar pedido"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-4" />
        </Button>
        {next ? (
          <Button
            type="button"
            className="ml-auto"
            onClick={() => onAdvance(order, next)}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {ADVANCE_LABEL[next] ?? ORDER_STATUS_META[next].label}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

/* ------------------------------ Editar cobro ------------------------------ */

function ChargeDialog({
  order,
  onClose,
  onSaved,
}: {
  order: BoardOrder | null;
  onClose: () => void;
  onSaved: (order: BoardOrder) => void;
}) {
  const [subtotal, setSubtotal] = useState(() => String(order?.subtotal ?? ""));
  const [fee, setFee] = useState(() => String(order?.delivery_fee ?? ""));
  const [finalValue, setFinalValue] = useState(() => String(order?.total ?? ""));
  const [finalTouched, setFinalTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!order) return null;
  const o = order;
  const isDelivery = o.delivery_type === "DOMICILIO";

  const subtotalNum = Number(subtotal);
  const feeNum = isDelivery ? Number(fee) : Number(o.delivery_fee);
  const finalNum = Number(finalValue);
  const valid =
    subtotal !== "" && Number.isFinite(subtotalNum) && subtotalNum >= 0 &&
    Number.isFinite(feeNum) && feeNum >= 0 &&
    (!finalTouched || (finalValue !== "" && Number.isFinite(finalNum) && finalNum >= 0));

  const base = subtotalNum + feeNum;
  // Mismo cálculo que updateOrderTotals: sin tocar el valor final se conserva
  // el ajuste (con tope para no dejar el total negativo).
  const previewTotal = finalTouched
    ? finalNum
    : base - Math.min(Number(o.final_adjustment ?? 0), base);

  async function handleSave() {
    if (!valid || saving) return;
    const patch: { subtotal?: number; deliveryFee?: number; finalValue?: number } = {};
    if (subtotalNum !== Number(o.subtotal)) patch.subtotal = subtotalNum;
    if (isDelivery && feeNum !== Number(o.delivery_fee)) patch.deliveryFee = feeNum;
    if (finalTouched && (finalNum !== Number(o.total) || Object.keys(patch).length > 0)) {
      patch.finalValue = finalNum;
    }

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    const res = await updateOrderTotals(o.id, patch);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(`Cobro del pedido ${formatOrderNumber(o.order_number)}: ${formatCOP(res.total ?? previewTotal)}`);
    onSaved({
      ...o,
      subtotal: res.subtotal ?? o.subtotal,
      delivery_fee: res.delivery_fee ?? o.delivery_fee,
      final_adjustment: res.final_adjustment ?? o.final_adjustment,
      total: res.total ?? o.total,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar cobro · {formatOrderNumber(o.order_number)}</DialogTitle>
          <DialogDescription>
            El ajuste del valor final solo se ve en el panel; el mensaje de WhatsApp conserva los valores originales.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="charge-subtotal">Subtotal de productos</Label>
            <Input
              id="charge-subtotal"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Bájalo si regalas un producto.</p>
          </div>

          {isDelivery ? (
            <div className="space-y-1.5">
              <Label htmlFor="charge-fee">Domicilio</Label>
              <Input
                id="charge-fee"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="charge-final">Valor final a cobrar (opcional)</Label>
            <Input
              id="charge-final"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={finalTouched ? finalValue : String(previewTotal)}
              onChange={(e) => {
                setFinalTouched(true);
                setFinalValue(e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Escríbelo solo si acordaste un total distinto con el cliente.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5">
            <span className="text-sm text-muted-foreground">Total a cobrar</span>
            <span className="text-lg font-bold tabular-nums text-price">
              {valid ? formatCOP(previewTotal) : "—"}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------- Editor de consumos por pedido ----------------------- */

function OrderConsumptionDialog({
  order,
  onOpenChange,
}: {
  order: BoardOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ConsumptionBreakDownItem[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    getOrderConsumptionBreakdown(order.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setItems(res.items ?? []);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  if (!order) return null;

  const o = order;
  // El inventario se descuenta al pasar a EN_PREPARACION; después ya no se ajusta.
  const locked = o.status !== "PENDIENTE" && o.status !== "CONFIRMADO";

  async function handleSave() {
    setSaving(true);
    const payload = items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantity: i.overrideQty ?? i.autoNeeded }));
    const res = await saveOrderConsumptionOverrides(o.id, payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumos del pedido actualizados");
    startTransition(() => onOpenChange(false));
  }

  function setQty(index: number, value: string) {
    const num = value === "" ? 0 : Number(value);
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, overrideQty: isNaN(num) ? 0 : num } : it))
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Insumos del pedido {formatOrderNumber(order.order_number)}
          </DialogTitle>
          <DialogDescription>
            {locked
              ? "Los insumos de este pedido ya se descontaron del inventario al pasar a preparación."
              : "Ajusta cuánto se descuenta de cada insumo (ej. “sin tomate” → 0). El descuento se aplica al pasar el pedido a preparación."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Calculando consumos…
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Este pedido no tiene consumos de insumos configurados.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it, i) => {
              const value = it.overrideQty ?? it.autoNeeded;
              const changed = it.overrideQty !== null && it.overrideQty !== it.autoNeeded;
              return (
                <div
                  key={it.inventoryItemId}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                    changed && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{it.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({it.unit})
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {it.references.join(" · ") || "Insumo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Auto: {it.autoNeeded}</span>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={value}
                      onChange={(e) => setQty(i, e.target.value)}
                      className="h-8 w-20 text-right"
                      aria-label={`Cantidad de ${it.name}`}
                      disabled={locked}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && items.length > 0 && !locked ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar consumos
            </Button>
          </DialogFooter>
        ) : !loading ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
