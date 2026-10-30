"use client";

import { OrdersBoard, type BoardOrder } from "@/components/admin/orders/orders-board";
import { DayHistory } from "@/components/admin/orders/day-history";
import type { DayOrder } from "@/components/admin/order-day";
import type { ManualProduct } from "@/components/admin/orders/manual-order-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function OrdersTabs({
  initialTab,
  initialOrders,
  deliveryFeeBusiness,
  products,
  initialMuted,
  historyOrders,
  selectedDate,
  today,
}: {
  initialTab: "live" | "history";
  initialOrders: BoardOrder[];
  deliveryFeeBusiness: number;
  products: ManualProduct[];
  initialMuted: boolean;
  historyOrders: DayOrder[];
  selectedDate: string;
  today: string;
}) {
  return (
    <Tabs defaultValue={initialTab} className="w-full gap-4">
      <TabsList className="h-10! w-full sm:w-fit">
        <TabsTrigger value="live" className="px-4">
          Pedidos en vivo
        </TabsTrigger>
        <TabsTrigger value="history" className="px-4">
          Historial
        </TabsTrigger>
      </TabsList>

      {/* El tablero queda montado al cambiar de pestaña para no perder la
          suscripción en tiempo real ni los pedidos que llegaron mientras tanto. */}
      <TabsContent value="live" forceMount className="data-[state=inactive]:hidden">
        <OrdersBoard
          initialOrders={initialOrders}
          deliveryFeeBusiness={deliveryFeeBusiness}
          products={products}
          initialMuted={initialMuted}
        />
      </TabsContent>

      <TabsContent value="history">
        <DayHistory orders={historyOrders} selectedDate={selectedDate} today={today} />
      </TabsContent>
    </Tabs>
  );
}
