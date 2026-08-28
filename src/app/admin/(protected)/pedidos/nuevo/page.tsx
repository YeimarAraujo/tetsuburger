import { createClient } from "@/lib/supabase/server";
import {
  ManualOrderForm,
  type ManualProduct,
} from "@/components/admin/orders/manual-order-form";
import { getAddonsAvailability } from "@/lib/consumption-availability";

export const metadata = {
  title: "Pedido manual · TETSUBURGER Admin",
};

export const dynamic = "force-dynamic";

export default async function ManualOrderPage() {
  const supabase = await createClient();

  const [productsRes, addonsRes, productAddonsRes, settingsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, image_url, is_available")
      .eq("is_active", true)
      .order("name"),
    supabase.from("addons").select("id, name, price").eq("is_active", true),
    supabase.from("product_addons").select("product_id, addon_id"),
    supabase.from("settings").select("key, value").eq("is_public", true),
  ]);

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

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-bold">Nuevo pedido manual</h1>
        <p className="text-sm text-muted-foreground">
          Registra pedidos tomados por llamada, en mesa o por WhatsApp
        </p>
      </header>

      <ManualOrderForm
        products={products}
        defaultDeliveryFee={Number(settings.delivery_fee ?? 0)}
      />
    </div>
  );
}
