import { Header } from "@/components/public/header";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { SocialLinks } from "@/components/public/social-links";
import { ClosedOverlay } from "@/components/public/closed-overlay";
import { FloatingCartButton } from "@/components/public/floating-cart-button";
import { type ProductCardData } from "@/components/public/product-card";
import { Button } from "@/components/ui/button";
import {
  MenuSections,
  type MenuSection,
} from "@/components/public/menu-sections";
import { SiteFooter } from "@/components/public/site-footer";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOpenStatus } from "@/lib/business-hours";
import { getAddonsAvailability } from "@/lib/consumption-availability";
import {
  buildMenuJsonLd,
  buildRestaurantJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { whatsappContactUrl } from "@/lib/whatsapp";

export const revalidate = 300;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function HomePage() {
  const supabase = createPublicClient();

  const [categoriesRes, productsRes, addonsRes, productAddonsRes, settingsRes, hoursRes] =
    await Promise.all([
      supabase.from("categories").select("*").eq("is_active", true).order("display_order"),
      supabase
        .from("products")
        .select(
          "id, category_id, name, slug, description, price, image_url, is_available, is_featured, conteo_hamburguesas, conteo_perros"
        )
        .eq("is_active", true)
        .order("name"),
      supabase.from("addons").select("id, name, price, tipo").eq("is_active", true),
      supabase.from("product_addons").select("product_id, addon_id"),
      supabase.from("settings").select("key, value").eq("is_public", true),
      supabase.from("business_hours").select("*"),
    ]);

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  const status = computeOpenStatus(
    hoursRes.data ?? [],
    settings.store_temporarily_closed === true,
    typeof settings.closed_message === "string" ? settings.closed_message : undefined
  );

  const addonMap = new Map((addonsRes.data ?? []).map((a) => [a.id, a]));

  const productAddonsMap = new Map<string, string[]>();
  for (const pa of productAddonsRes.data ?? []) {
    if (!addonMap.has(pa.addon_id)) continue;
    const list = productAddonsMap.get(pa.product_id) ?? [];
    list.push(pa.addon_id);
    productAddonsMap.set(pa.product_id, list);
  }

  const products = productsRes.data ?? [];

  // Disponibilidad de adiciones (si el insumo no alcanza, se desactivan).
  const availabilityByProduct = await getAddonsAvailability(
    products.map((p) => p.id)
  );

  // Ranking: pedidos entregados (últimos 90 días) + promedio de reseñas aprobadas.
  interface RatingInfo {
    avg: number;
    count: number;
  }
  const ratingMap = new Map<string, RatingInfo>();
  const qtyMap = new Map<string, number>();

  const activeIds = new Set(products.map((p) => p.id));
  const ninetyDaysAgo = isoDaysAgo(90);

  await Promise.all([
    (async () => {
      const admin = createAdminClient();
      const { data: rows } = await admin
        .from("order_items")
        .select("product_id, quantity, orders!inner(status, created_at)")
        .eq("orders.status", "ENTREGADO")
        .gte("orders.created_at", ninetyDaysAgo)
        .not("product_id", "is", null)
        .limit(5000);
      for (const row of rows ?? []) {
        if (!row.product_id || !activeIds.has(row.product_id)) continue;
        qtyMap.set(
          row.product_id,
          (qtyMap.get(row.product_id) ?? 0) + (Number(row.quantity) || 0)
        );
      }
    })(),
    (async () => {
      const { data: reviews } = await supabase
        .from("product_reviews")
        .select("product_id, rating")
        .eq("status", "APROBADO")
        .limit(5000);
      const acc = new Map<string, { sum: number; count: number }>();
      for (const r of reviews ?? []) {
        if (!activeIds.has(r.product_id)) continue;
        const cur = acc.get(r.product_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(r.rating) || 0;
        cur.count += 1;
        acc.set(r.product_id, cur);
      }
      for (const [pid, { sum, count }] of acc) {
        ratingMap.set(pid, { avg: sum / count, count });
      }
    })(),
  ]);

  const bestSellers = products
    .filter((p) => p.is_available && (qtyMap.get(p.id) ?? 0) > 0)
    .sort((a, b) => (qtyMap.get(b.id) ?? 0) - (qtyMap.get(a.id) ?? 0))
    .slice(0, 3);

  const topRated = products
    .filter((p) => p.is_available && ratingMap.has(p.id))
    .sort((a, b) => {
      const ra = ratingMap.get(a.id)!;
      const rb = ratingMap.get(b.id)!;
      if (rb.avg !== ra.avg) return rb.avg - ra.avg;
      return rb.count - ra.count;
    })
    .slice(0, 6);

  function toCard(p: {
    id: string; name: string; slug: string; description: string; price: number;
    image_url: string; is_available: boolean;
    conteo_hamburguesas: number; conteo_perros: number;
  }): ProductCardData {
    const avail = availabilityByProduct.get(p.id) ?? new Map<string, boolean>();
    const hamburguesas = Number(p.conteo_hamburguesas) || 0;
    const perros = Number(p.conteo_perros) || 0;
    return {
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
      rating: ratingMap.get(p.id) ?? null,
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
    };
  }

  const featured = products.filter((p) => p.is_featured && p.is_available);
  const heroImage = "/images/bannerTetsu.webp";

  const categoryOptions = categoriesRes.data ?? [];
  const sections: MenuSection[] = [];

  if (featured.length > 0) {
    sections.push({
      key: "destacados",
      label: "Destacados",
      icon: "flame",
      tagline: "Nuestras recomendaciones de la casa",
      items: featured.map(toCard),
      default: true,
      special: true,
    });
  }

  if (bestSellers.length > 0) {
    sections.push({
      key: "mas-pedidos",
      label: "Los más pedidos",
      icon: "trending",
      tagline: "Lo que más se ha pedido en los últimos 90 días",
      items: bestSellers.map(toCard),
      default: sections.length === 0,
      special: true,
    });
  }

  if (topRated.length > 0) {
    sections.push({
      key: "mejor-valorados",
      label: "Mejor valorados",
      icon: "star",
      tagline: "Promedio de estrellas de nuestras clientas y clientes",
      items: topRated.map(toCard),
      default: sections.length === 0,
      special: true,
    });
  }

  for (const category of categoryOptions) {
    const items = products.filter((p) => p.category_id === category.id);
    if (items.length === 0) continue;
    sections.push({
      key: `cat-${category.slug}`,
      label: category.name,
      tagline: category.description || undefined,
      items: items.map(toCard),
      default: sections.length === 0,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            buildRestaurantJsonLd(hoursRes.data ?? [])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            buildMenuJsonLd(
              products.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                description: p.description,
                price: Number(p.price) || 0,
                is_available: p.is_available,
                category_id: p.category_id,
              })),
              categoryOptions.map((c) => ({ id: c.id, name: c.name }))
            )
          ),
        }}
      />
      <Header />
      <FloatingCartButton />

      {!status.isOpen ? (
        <ClosedOverlay message={status.message} nextOpensAt={status.nextOpensAt} />
      ) : null}

      {/* Hero */}
      <section className="relative border-b overflow-hidden">
        {heroImage ? (
          <Image
            src={heroImage}
            alt="Imagen de TETSU BURGER"
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-orange-600 to-red-700" />
        )}

        <div className="relative mx-auto max-w-5xl space-y-4 px-4 py-20 sm:py-28">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
              status.isOpen
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            )}
          >
            <span className={cn("size-2 rounded-full", status.isOpen ? "animate-pulse bg-white" : "bg-white")} />
            {status.isOpen ? "Abierto" : "Cerrado"}
          </span>

          <h1 className="max-w-60 font-display text-4xl leading-tight tracking-wide text-white sm:max-w-md sm:text-5xl lg:max-w-xl lg:text-6xl">
            SAZÓN SOBRE LA PLANCHA
          </h1>

          <p className="max-w-xl text-[15px] leading-relaxed text-white sm:text-base lg:text-lg">
            {status.message}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* <Button
              asChild
              size="lg"
              className="h-11 gap-2 bg-white text-foreground hover:bg-white/90"
            >
              <a
                href={whatsappContactUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Pedir por WhatsApp
              </a>
            </Button> */}

            <SocialLinks />
          </div>
        </div>
      </section>

      {/* Filtros + menú */}
      <div id="menu" className="scroll-mt-28" />
      <MenuSections sections={sections} />

      <SiteFooter />
    </div>
  );
}
