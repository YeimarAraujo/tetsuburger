import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { BoardOrder } from "@/components/admin/orders/orders-board";
import type { ManualProduct } from "@/components/admin/orders/manual-order-form";
import type { DayOrder } from "@/components/admin/order-day";
import { OrdersTabs } from "@/components/admin/orders/orders-tabs";
import { getAddonsAvailability } from "@/lib/consumption-availability";
import { bogotaToday } from "@/lib/bogota";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pedidos · TETSU BURGER Admin",
};

export const dynamic = "force-dynamic";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const today = bogotaToday();
  const requestedDate =
    typeof params.fecha === "string" ? params.fecha : "";
  const selectedDate = isValidDate(requestedDate) ? requestedDate : today;

  const [orders, settings, productsRes, addonsRes, productAddonsRes, me, historyRes] = await Promise.all([
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
    supabase.from("addons").select("id, name, price, tipo").eq("is_active", true),
    supabase.from("product_addons").select("product_id, addon_id"),
    supabase.auth.getUser(),
    supabase
      .from("orders")
      .select("id, order_number, status, customer_name, subtotal, final_adjustment, total, payment_method, origin, created_at")
      .gte("created_at", `${selectedDate}T00:00:00-05:00`)
      .lte("created_at", `${selectedDate}T23:59:59-05:00`)
      .order("created_at", { ascending: false }),
  ]);

  const deliveryFeeBusiness = Number(settings.data?.value ?? 0);

  const profileRes = me.data?.user
    ? await supabase
      .from("profiles")
      .select("board_muted")
      .eq("id", me.data.user.id)
      .maybeSingle()
    : { data: null };
  const initialMuted = profileRes.data?.board_muted === true;

  const rawProducts = productsRes.data ?? [];
  const availabilityByProduct = await getAddonsAvailability(
    rawProducts.map((p) => p.id)
  );

  const addonMap = new Map(
    (addonsRes.data ?? []).map((a) => [
      a.id,
      {
        id: a.id,
        name: a.name,
        price: Number(a.price),
        tipo: a.tipo,
      },
    ])
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
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Pedidos"
        description="Gestiona los pedidos en vivo y consulta el historial por día"
      >
        <Button asChild>
          <Link href="/admin/pedidos/nuevo">
            <Plus className="size-4" />
            Pedido manual
          </Link>
        </Button>
      </PageHeader>

      <OrdersTabs
        initialTab={requestedDate ? "history" : "live"}
        initialOrders={(orders.data ?? []) as unknown as BoardOrder[]}
        deliveryFeeBusiness={deliveryFeeBusiness}
        products={products}
        initialMuted={initialMuted}
        historyOrders={(historyRes.data ?? []) as DayOrder[]}
        selectedDate={selectedDate}
        today={today}
      />
    </div>
  );
}
