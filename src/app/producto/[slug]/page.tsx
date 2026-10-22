import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Header } from "@/components/public/header";
import { SiteFooter } from "@/components/public/site-footer";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/public/product-card";
import { createPublicClient } from "@/lib/supabase/public";
import { getAddonsAvailability } from "@/lib/consumption-availability";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import { formatCOP } from "@/lib/format";
import type { AddonTipo } from "@/types/db";

export const revalidate = 300;

export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((product) => ({ slug: product.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, category_id, name, slug, description, price, image_url, is_available, conteo_hamburguesas, conteo_perros, categories(name, slug)"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

function absoluteImage(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${getSiteUrl()}${url}`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: "Producto no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const description =
    product.description?.slice(0, 155) ??
    `${product.name} a domicilio en Valledupar.`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/producto/${product.slug}`,
      images: product.image_url
        ? [{ url: absoluteImage(product.image_url), alt: product.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const supabase = createPublicClient();

  const [productAddonsRes, reviewsRes] = await Promise.all([
    supabase
      .from("product_addons")
      .select("addon_id")
      .eq("product_id", product.id),
    supabase
      .from("product_reviews")
      .select("rating")
      .eq("product_id", product.id)
      .eq("status", "APROBADO"),
  ]);

  const addonIds = (productAddonsRes.data ?? []).map((row) => row.addon_id);
  const { data: addonsData } =
    addonIds.length > 0
      ? await supabase
          .from("addons")
          .select("id, name, price, tipo")
          .in("id", addonIds)
          .eq("is_active", true)
      : { data: [] };

  const availability = await getAddonsAvailability([product.id]);
  const availableAddons =
    availability.get(product.id) ?? new Map<string, boolean>();

  const ratings = (reviewsRes.data ?? []).map((r) => Number(r.rating) || 0);
  const rating =
    ratings.length > 0
      ? {
          avg: ratings.reduce((sum, value) => sum + value, 0) / ratings.length,
          count: ratings.length,
        }
      : null;

  const category = Array.isArray(product.categories)
    ? product.categories[0]
    : product.categories;

  const hamburguesas = Number(product.conteo_hamburguesas) || 0;
  const perros = Number(product.conteo_perros) || 0;

  const card: ProductCardData = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: Number(product.price) || 0,
    imageUrl: product.image_url,
    isAvailable: product.is_available,
    isCombo: hamburguesas + perros >= 2,
    hamburguesas,
    perros,
    rating,
    addons: (addonsData ?? []).map((addon) => ({
      id: addon.id,
      name: addon.name,
      price: Number(addon.price),
      available: availableAddons.get(addon.id),
      tipo: addon.tipo as AddonTipo,
    })),
  };

  const crumbs = [
    { name: "Inicio", path: "/" },
    ...(category
      ? [
          {
            name: category.name,
            path: `/#cat-${category.slug}`,
          },
        ]
      : []),
    { name: product.name, path: `/producto/${product.slug}` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            buildProductJsonLd({
              id: product.id,
              slug: product.slug,
              name: product.name,
              description: product.description,
              imageUrl: product.image_url
                ? absoluteImage(product.image_url)
                : `${getSiteUrl()}/images/logo.webp`,
              price: Number(product.price) || 0,
              isAvailable: product.is_available,
              category: category?.name ?? null,
              rating,
            })
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildBreadcrumbJsonLd(crumbs)),
        }}
      />
      <Header />

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <nav aria-label="Migas de pan" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={crumb.path} className="flex items-center gap-1">
                  {last ? (
                    <span aria-current="page" className="font-medium text-foreground">
                      {crumb.name}
                    </span>
                  ) : (
                    <Link
                      href={crumb.path}
                      className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {crumb.name}
                    </Link>
                  )}
                  {!last ? (
                    <ChevronRight aria-hidden="true" className="size-4" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatCOP(card.price)} · Domicilios en Valledupar
          </p>
        </div>

        <ProductCard product={card} />

        <div className="mt-8 space-y-3">
          {product.description ? (
            <p className="text-base leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}
          <Link
            href="/#menu"
            className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Volver al menú completo
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
