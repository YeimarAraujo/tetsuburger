import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrdersBoard, type BoardOrder } from "@/components/admin/orders/orders-board";
import type { ManualProduct } from "@/components/admin/orders/manual-order-form";
import { getAddonsAvailability } from "@/lib/consumption-availability";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pedidos · TETSUBURGER Admin",
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();

  const [orders, settings, productsRes, addonsRes, productAddonsRes] = await Promise.all([
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
    supabase
      .from("products")
      .select("id, name, price, image_url, is_available")
      .eq("is_active", true)
      .order("name"),
    supabase.from("addons").select("id, name, price").eq("is_active", true),
    supabase.from("product_addons").select("product_id, addon_id"),
  ]);

  const deliveryFeeBusiness = Number(settings.data?.value ?? 0);

  const rawProducts = productsRes.data ?? [];
  const availabilityByProduct = await getAddonsAvailability(
    rawProducts.map((p) => p.id)
  );

  const addonMap = new Map(
    (addonsRes.data ?? []).map((a) => [a.id, { id: a.id, name: a.name, price: Number(a.price) }])
  );

  const productAddonsMap = new Map<string, string[]>();
  for (const pa of productAddonsRes.data ?? []) {
    if (!addonMap.has(pa.addon_id)) continue;
    const list = productAddonsMap.get(pa.product_id) ?? [];
    list.push(pa.addon_id);
    productAddonsMap.set(pa.product_id, list);
  }

  const products: ManualProduct[] = rawProducts.map((p) => {
    const avail = availabilityByProduct.get(p.id) ?? new Map<string, boolean>();
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      image_url: p.image_url,
      is_available: p.is_available,
      addons: (productAddonsMap.get(p.id) ?? [])
        .map((id) => addonMap.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({ ...a, available: avail.get(a.id) })),
    };
  });

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
        products={products}
      />
    </div>
  );
}
