import { Header } from "@/components/public/header";
import { ClosedOverlay } from "@/components/public/closed-overlay";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/public/product-card";
import { createClient } from "@/lib/supabase/server";
import { computeOpenStatus } from "@/lib/business-hours";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const [categoriesRes, productsRes, addonsRes, productAddonsRes, settingsRes, hoursRes] =
    await Promise.all([
      supabase.from("categories").select("*").eq("is_active", true).order("display_order"),
      supabase
        .from("products")
        .select(
          "id, category_id, name, slug, description, price, image_url, is_available, is_featured"
        )
        .eq("is_active", true)
        .order("name"),
      supabase.from("addons").select("id, name, price").eq("is_active", true),
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

  function toCard(p: {
    id: string; name: string; description: string; price: number;
    image_url: string; is_available: boolean;
  }): ProductCardData {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      imageUrl: p.image_url,
      isAvailable: p.is_available,
      addons: (productAddonsMap.get(p.id) ?? [])
        .map((id) => addonMap.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) })),
    };
  }

  const products = productsRes.data ?? [];
  const featured = products.filter((p) => p.is_featured && p.is_available);
  const heroImage = "/images/bannerTetsu.webp";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {!status.isOpen ? (
        <ClosedOverlay message={status.message} nextOpensAt={status.nextOpensAt} />
      ) : null}

      {/* Hero */}
      <section className="relative border-b overflow-hidden">
        {heroImage ? (
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-orange-600 to-red-700" />
        )}

        <div className="relative mx-auto max-w-5xl space-y-4 px-4 py-20 sm:py-28">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
              status.isOpen
                ? "bg-emerald-500 text-white"
                : "bg-red-500 text-white"
            )}
          >
            <span className={cn("size-2 rounded-full", status.isOpen ? "animate-pulse bg-white" : "bg-white")} />
            {status.isOpen ? "Abierto" : "Cerrado"}
          </span>

          <h1 className="font-display text-5xl tracking-wider text-white sm:text-7xl">
            SAZÓN SOBRE LA PLANCHA
          </h1>
          <p className="font-display text-5xl tracking-wider text-white sm:text-3xl">
            {status.message}
          </p>
        </div>
      </section>

      {/* Destacados */}
      {featured.length > 0 ? (
        <section className="mx-auto max-w-5xl px-4 pt-8">
          <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">
            🔥 Destacados
          </h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {featured.map((p) => (
              <div key={p.id} className="w-[320px] shrink-0 snap-start">
                <ProductCard product={toCard(p)} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Navegación de categorías */}
      {(categoriesRes.data ?? []).length > 0 ? (
        <nav className="sticky top-14 z-30 mt-8 border-y bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2">
            {(categoriesRes.data ?? []).map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.slug}`}
                className="whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
              >
                {c.name}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {/* Menú por categorías */}
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {(categoriesRes.data ?? []).map((category) => {
          const items = products.filter((p) => p.category_id === category.id);
          if (items.length === 0) return null;

          return (
            <section key={category.id} id={`cat-${category.slug}`} className="scroll-mt-28">
              <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">
                {category.name}
              </h2>
              {category.description ? (
                <p className="mb-4 text-sm text-muted-foreground">{category.description}</p>
              ) : (
                <p className="mb-4 text-xs text-muted-foreground">
                  {items.length} opciones
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((p) => (
                  <ProductCard key={p.id} product={toCard(p)} />
                ))}
              </div>
            </section>
          );
        })}

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            El menú se está preparando, vuelve en un momento.
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl space-y-2 px-4 text-center text-sm text-muted-foreground">
          {typeof settings.address === "string" && settings.address ? (
            <p>{settings.address}</p>
          ) : null}
          <p>© {new Date().getFullYear()} TETSUBURGER · Todos los derechos reservados</p>
        </div>
      </footer>
    </div>
  );
}
