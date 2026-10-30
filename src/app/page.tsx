import { Header } from "@/components/public/header";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { SocialLinks } from "@/components/public/social-links";
import { BurgerPattern } from "@/components/ui/burger-pattern";
import {
  ClosedOverlay,
  StoreStatusBadge,
  StoreStatusMessage,
  StoreStatusProvider,
} from "@/components/public/store-status";
import { FloatingCartButton } from "@/components/public/floating-cart-button";
import { type ProductCardData } from "@/components/public/product-card";
import {
  MenuSections,
  type MenuSection,
} from "@/components/public/menu-sections";
import { SiteFooter } from "@/components/public/site-footer";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentMinute } from "@/lib/business-hours";
import { buildProductCards } from "@/lib/product-cards";
import {
  buildMenuJsonLd,
  buildRestaurantJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export const revalidate = 300;

export default async function HomePage() {
  const supabase = createPublicClient();

  const [categoriesRes, productsRes, settingsRes, hoursRes, outsideHoursRes] =
    await Promise.all([
      supabase.from("categories").select("*").eq("is_active", true).order("display_order"),
      supabase
        .from("products")
        .select(
          "id, category_id, name, slug, description, price, image_url, is_available, is_featured, conteo_hamburguesas, conteo_perros"
        )
        .eq("is_active", true)
        .order("name"),
      supabase.from("settings").select("key, value").eq("is_public", true),
      supabase.from("business_hours").select("*"),
      // Configuración no pública: solo se usa para saber si se aceptan pedidos
      // fuera de horario (igual que valida placeOrder).
      createAdminClient()
        .from("settings")
        .select("value")
        .eq("key", "allow_orders_outside_hours")
        .maybeSingle(),
    ]);

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  const temporarilyClosed = settings.store_temporarily_closed === true;
  const closedMessage =
    typeof settings.closed_message === "string" ? settings.closed_message : undefined;
  const allowOutsideHours = outsideHoursRes.data?.value === true;

  const products = productsRes.data ?? [];
  const cards = await buildProductCards(supabase, products);
  const toCard = (p: { id: string }): ProductCardData => cards.get(p.id)!;

  const featured = products.filter((p) => p.is_featured && p.is_available);
  // const heroImage = "/images/bannerTetsu.webp";

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
      <StoreStatusProvider
        hours={hoursRes.data ?? []}
        temporarilyClosed={temporarilyClosed}
        closedMessage={closedMessage}
        allowOutsideHours={allowOutsideHours}
        renderedAtMinute={currentMinute()}
      >
        <Header />
        <ClosedOverlay />
        <FloatingCartButton />

        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b bg-primary">
          {/* Banner anterior (foto de fondo), reemplazado por el patrón de hamburguesas + Tetsito
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
          */}
          <BurgerPattern id="hero" opacity={0.18} />

          {/* Mascota a un lado; el título deja espacio con su max-w */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="relative mx-auto h-full max-w-5xl">
              <Image
                src="/images/tetsitoHero.webp"
                alt=""
                width={443}
                height={432}
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 256px, 144px"
                className="absolute right-5 top-1/2 w-36 -translate-y-1/2 min-[480px]:right-8 min-[480px]:w-44 sm:right-14 sm:w-64 lg:right-28 lg:w-80"
              />
            </div>
          </div>

          <div className="relative mx-auto max-w-5xl space-y-4 px-4 py-14 sm:py-24">
            <StoreStatusBadge />

            <h1 className="max-w-[10.5rem] min-[480px]:max-w-60 font-display text-4xl leading-tight tracking-wide text-white sm:max-w-md sm:text-5xl lg:max-w-xl lg:text-6xl">
              SAZÓN SOBRE LA PLANCHA
            </h1>

            <StoreStatusMessage className="max-w-xl text-[15px] leading-relaxed text-white sm:text-base lg:text-lg" />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* <a
                href="#menu"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 motion-reduce:transition-none"
              >
                Ver menú
                <ChevronDown aria-hidden="true" className="size-4" />
              </a> */}

              <SocialLinks />
            </div>
          </div>
        </section>

        {/* Filtros + menú */}
        <div id="menu" className="scroll-mt-28" />
        <MenuSections sections={sections} />

        <SiteFooter />
      </StoreStatusProvider>
    </div>
  );
}
