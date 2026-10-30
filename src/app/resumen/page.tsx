import type { Metadata } from "next";
import { Header } from "@/components/public/header";
import { SiteFooter } from "@/components/public/site-footer";
import {
  ResumenContent,
  type CatalogEntry,
} from "@/components/public/resumen-content";
import { createPublicClient } from "@/lib/supabase/public";
import { buildProductCards } from "@/lib/product-cards";

export const metadata: Metadata = {
  title: "Resumen del pedido",
  robots: { index: false, follow: false },
};

// El carrito vive en el navegador; aquí solo se precarga el catálogo público.
export const revalidate = 300;

export default async function ResumenPage() {
  const supabase = createPublicClient();

  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase.from("settings").select("key, value").eq("is_public", true),
    supabase.from("categories").select("id").eq("is_active", true).order("display_order"),
    supabase
      .from("products")
      .select(
        "id, category_id, name, slug, description, price, image_url, is_available, conteo_hamburguesas, conteo_perros"
      )
      .eq("is_active", true)
      .eq("is_available", true)
      .order("name"),
  ]);

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  const deliveryFee = Number(settings.delivery_fee ?? 0);
  const deliveryFeeAconvenir = settings.delivery_fee_a_convenir === true;

  const categoryOrder = new Map(
    (categoriesRes.data ?? []).map((c, index) => [c.id, index])
  );
  const products = (productsRes.data ?? []).filter((p) => categoryOrder.has(p.category_id));
  const cards = await buildProductCards(supabase, products);

  const catalog: CatalogEntry[] = products.map((p) => ({
    card: cards.get(p.id)!,
    categoryId: p.category_id,
    categoryOrder: categoryOrder.get(p.category_id) ?? 0,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Header />
      <div className="flex-1">
        <ResumenContent
          deliveryFee={deliveryFee}
          deliveryFeeAconvenir={deliveryFeeAconvenir}
          catalog={catalog}
        />
      </div>
      <SiteFooter />
    </div>
  );
}
