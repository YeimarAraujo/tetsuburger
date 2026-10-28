"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  OrderDayList,
  OrderDaySummary,
  summarizeDayOrders,
  type DayOrder,
} from "@/components/admin/order-day";

export function TodayOrdersDialog({
  orders,
  dateLabel,
}: {
  orders: DayOrder[];
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = summarizeDayOrders(orders);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-xs font-medium text-primary hover:underline"
      >
        {summary.total === 1
          ? "Ver el pedido del día →"
          : `Ver los ${summary.total} pedidos del día →`}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pedidos del día</DialogTitle>
            <DialogDescription>
              {dateLabel} · todos los estados, incluidos entregados y cancelados.
            </DialogDescription>
          </DialogHeader>

          <OrderDaySummary orders={orders} />

          <div className="max-h-[55vh] overflow-y-auto pr-1">
            <OrderDayList orders={orders} />
          </div>

          <DialogFooter>
            <Link
              href="/admin/pedidos"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ir al tablero de pedidos activos
              <ArrowRight className="size-3.5" />
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
