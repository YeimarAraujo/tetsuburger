import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrdersBoard, type BoardOrder } from "@/components/admin/orders/orders-board";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pedidos · TETSUBURGER Admin",
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();

  const [orders, settings] = await Promise.all([
    supabase
      .from("orders")
      .select("*, items:order_items(*, order_item_addons(*))")
      .in("status", [
        "PENDIENTE",
        "CONFIRMADO",
        "EN_PREPARACION",
        "LISTO",
        "EN_CAMINO",
      ])
      .order("created_at"),
    supabase
      .from("settings")
      .select("key, value")
      .eq("key", "delivery_fee_business")
      .single(),
  ]);

  const deliveryFeeBusiness = Number(settings.data?.value ?? 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos en vivo</h1>
          <p className="text-sm text-muted-foreground">
            Los pedidos nuevos aparecen solos, con alerta sonora · orden por
            llegada (los más antiguos arriba)
          </p>
        </div>
        <Link href="/admin/pedidos/nuevo">
          <Button>
            <Plus className="size-4" />
            Pedido manual
          </Button>
        </Link>
      </header>

      <OrdersBoard
        initialOrders={(orders.data ?? []) as unknown as BoardOrder[]}
        deliveryFeeBusiness={deliveryFeeBusiness}
      />
    </div>
  );
}
