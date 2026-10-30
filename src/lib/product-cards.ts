import "server-only";
import type { ProductCardData } from "@/components/public/product-card";
import type { createPublicClient } from "@/lib/supabase/public";
import { getAddonsAvailability } from "@/lib/consumption-availability";

export interface CardSourceProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  conteo_hamburguesas: number;
  conteo_perros: number;
}

/**
 * Datos de las tarjetas del menú (adicionales con disponibilidad por insumos
 * y promedio de reseñas aprobadas). Lo usan el home y el resumen del pedido.
 */
export async function buildProductCards(
  supabase: ReturnType<typeof createPublicClient>,
  products: CardSourceProduct[]
): Promise<Map<string, ProductCardData>> {
  const ids = products.map((p) => p.id);
  const activeIds = new Set(ids);

  const [addonsRes, productAddonsRes, reviewsRes, availabilityByProduct] = await Promise.all([
    supabase.from("addons").select("id, name, price, tipo").eq("is_active", true),
    supabase.from("product_addons").select("product_id, addon_id"),
    supabase
      .from("product_reviews")
      .select("product_id, rating")
      .eq("status", "APROBADO")
      .limit(5000),
    getAddonsAvailability(ids),
  ]);

  const addonMap = new Map((addonsRes.data ?? []).map((a) => [a.id, a]));

  const productAddonsMap = new Map<string, string[]>();
  for (const pa of productAddonsRes.data ?? []) {
    if (!addonMap.has(pa.addon_id)) continue;
    const list = productAddonsMap.get(pa.product_id) ?? [];
    list.push(pa.addon_id);
    productAddonsMap.set(pa.product_id, list);
  }

  const ratingAcc = new Map<string, { sum: number; count: number }>();
  for (const r of reviewsRes.data ?? []) {
    if (!activeIds.has(r.product_id)) continue;
    const cur = ratingAcc.get(r.product_id) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.rating) || 0;
    cur.count += 1;
    ratingAcc.set(r.product_id, cur);
  }

  const cards = new Map<string, ProductCardData>();
  for (const p of products) {
    const avail = availabilityByProduct.get(p.id) ?? new Map<string, boolean>();
    const hamburguesas = Number(p.conteo_hamburguesas) || 0;
    const perros = Number(p.conteo_perros) || 0;
    const rating = ratingAcc.get(p.id);
    cards.set(p.id, {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: Number(p.price) || 0,
      imageUrl: p.image_url,
      isAvailable: p.is_available,
      isCombo: hamburguesas + perros >= 2,
      hamburguesas,
      perros,
      rating: rating ? { avg: rating.sum / rating.count, count: rating.count } : null,
      addons: (productAddonsMap.get(p.id) ?? [])
        .map((id) => addonMap.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({
          id: a.id,
          name: a.name,
          price: Number(a.price),
          available: avail.get(a.id),
          tipo: a.tipo,
        })),
    });
  }

  return cards;
}
