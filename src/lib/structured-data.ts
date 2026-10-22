import { site } from "@/config/site";
import { getSiteUrl } from "@/lib/site-url";
import { whatsappContactUrl } from "@/lib/whatsapp";

export interface PublicHour {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** JSON-LD de `Restaurant` (cocina oculta con domicilios). */
export function buildRestaurantJsonLd(hours: PublicHour[]) {
  const base = getSiteUrl();

  const openingHoursSpecification = hours
    .filter((row) => row.is_active)
    .map((row) => ({
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: SCHEMA_DAYS[row.day_of_week],
      opens: row.opens_at.slice(0, 5),
      closes: row.closes_at.slice(0, 5),
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${base}/#restaurant`,
    name: site.name,
    description:
      "Hamburguesas, perros calientes y papas a domicilio en Valledupar.",
    url: base,
    image: `${base}/opengraph-image`,
    telephone: site.phone,
    email: site.email,
    priceRange: site.priceRange,
    servesCuisine: site.cuisines,
    address: {
      "@type": "PostalAddress",
      addressLocality: site.city,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    areaServed: {
      "@type": "City",
      name: site.city,
    },
    sameAs: [site.social.instagram],
    hasMenu: `${base}/#menu`,
    ...(openingHoursSpecification.length > 0
      ? { openingHoursSpecification }
      : {}),
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: whatsappContactUrl(),
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
    },
  };
}

/** Serializa JSON-LD de forma segura para incrustar en un `<script>`. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface MenuProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  category_id: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
}

function menuItem(product: MenuProduct, base: string) {
  const url = `${base}/producto/${product.slug}`;
  return {
    "@type": "MenuItem" as const,
    name: product.name,
    description: product.description,
    url,
    offers: {
      "@type": "Offer" as const,
      price: product.price,
      priceCurrency: "COP",
      availability: product.is_available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url,
    },
  };
}

/** JSON-LD `Menu` con secciones por categoría y sus productos. */
export function buildMenuJsonLd(
  products: MenuProduct[],
  categories: MenuCategory[]
) {
  const base = getSiteUrl();

  const sections = categories
    .map((category) => {
      const items = products.filter((p) => p.category_id === category.id);
      if (items.length === 0) return null;
      return {
        "@type": "MenuSection" as const,
        name: category.name,
        hasMenuItem: items.map((p) => menuItem(p, base)),
      };
    })
    .filter((section): section is NonNullable<typeof section> =>
      Boolean(section)
    );

  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${base}/#menu`,
    name: `Menú de ${site.name}`,
    url: base,
    inLanguage: "es-CO",
    hasMenuSection: sections,
  };
}

/** JSON-LD `Product` + `Offer` (y `AggregateRating` si hay reseñas). */
export function buildProductJsonLd(params: {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  isAvailable: boolean;
  category?: string | null;
  rating?: { avg: number; count: number } | null;
}) {
  const base = getSiteUrl();
  const url = `${base}/producto/${params.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: params.name,
    description: params.description,
    image: [params.imageUrl],
    sku: params.id,
    url,
    ...(params.category ? { category: params.category } : {}),
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "Offer",
      url,
      price: params.price,
      priceCurrency: "COP",
      availability: params.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: site.name },
    },
    ...(params.rating && params.rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: params.rating.avg.toFixed(2),
            reviewCount: params.rating.count,
          },
        }
      : {}),
  };
}

/** JSON-LD `BreadcrumbList` a partir de pares nombre/ruta. */
export function buildBreadcrumbJsonLd(
  crumbs: Array<{ name: string; path: string }>
) {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${base}${crumb.path}`,
    })),
  };
}
