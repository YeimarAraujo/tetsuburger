import { ACTIVE_STATUSES, ORDER_STATUS_META } from "@/lib/order-status";
import { formatCOP, formatOrderNumber, formatTime } from "@/lib/format";
import type { OrderStatus } from "@/types/db";
import { cn } from "@/lib/utils";

export interface DayOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string | null;
  subtotal: number;
  final_adjustment: number | null;
  total: number;
  payment_method: string | null;
  origin: string;
  created_at: string;
}

export function summarizeDayOrders(orders: DayOrder[]) {
  const delivered = orders.filter((o) => o.status === "ENTREGADO");
  const cancelled = orders.filter((o) => o.status === "CANCELADO");
  const inProgress = orders.filter((o) =>
    ACTIVE_STATUSES.includes(o.status)
  );

  return {
    total: orders.length,
    delivered: delivered.length,
    inProgress: inProgress.length,
    cancelled: cancelled.length,
    sales: delivered.reduce(
      (sum, o) => sum + Number(o.subtotal) - Number(o.final_adjustment ?? 0),
      0
    ),
  };
}

export function OrderDaySummary({ orders }: { orders: DayOrder[] }) {
  const summary = summarizeDayOrders(orders);

  const items = [
    { label: "Pedidos", value: String(summary.total) },
    { label: "Entregados", value: String(summary.delivered) },
    { label: "En curso", value: String(summary.inProgress) },
    { label: "Cancelados", value: String(summary.cancelled) },
    { label: "Ventas entregadas", value: formatCOP(summary.sales) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border bg-muted/40 px-2.5 py-2"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="text-sm font-bold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function OrderDayList({ orders }: { orders: DayOrder[] }) {
  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay pedidos registrados este día.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {orders.map((order) => {
        const meta = ORDER_STATUS_META[order.status];
        const cancelled = order.status === "CANCELADO";

        return (
          <li
            key={order.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5",
              cancelled && "opacity-60"
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {formatOrderNumber(order.order_number)}
              </span>
              <span className="truncate text-sm font-medium">
                {order.customer_name || "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(order.created_at)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  meta.badgeClass
                )}
              >
                {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {order.payment_method === "TRANSFERENCIA"
                  ? "Transferencia"
                  : "Efectivo"}{" "}
                · {order.origin === "WEB" ? "Web" : "Manual"}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCOP(Number(order.total))}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
