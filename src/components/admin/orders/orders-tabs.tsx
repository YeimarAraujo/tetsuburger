"use client";

import { OrdersBoard, type BoardOrder } from "@/components/admin/orders/orders-board";
import { DayHistory } from "@/components/admin/orders/day-history";
import type { DayOrder } from "@/components/admin/order-day";
import type { ManualProduct } from "@/components/admin/orders/manual-order-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function OrdersTabs({
  initialOrders,
  deliveryFeeBusiness,
  products,
  initialMuted,
  historyOrders,
  selectedDate,
  today,
}: {
  initialOrders: BoardOrder[];
  deliveryFeeBusiness: number;
  products: ManualProduct[];
  initialMuted: boolean;
  historyOrders: DayOrder[];
  selectedDate: string;
  today: string;
}) {
  return (
    <div className="w-full">
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="w-full border-b border-border">
          <TabsTrigger value="live" className="px-4 py-2.5">
            Pedidos en vivo
          </TabsTrigger>
          <TabsTrigger value="history" className="px-4 py-2.5">
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4 space-y-4">
          <OrdersBoard
            initialOrders={initialOrders}
            deliveryFeeBusiness={deliveryFeeBusiness}
            products={products}
            initialMuted={initialMuted}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <DayHistory
            orders={historyOrders}
            selectedDate={selectedDate}
            today={today}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
