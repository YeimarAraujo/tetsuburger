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
