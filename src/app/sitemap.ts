import type { MetadataRoute } from "next";
import { getSiteUrl, isProductionDeployment } from "@/lib/site-url";
import { site } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

const staticPages: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/privacidad", changeFrequency: "yearly", priority: 0.5 },
  { path: "/terminos", changeFrequency: "yearly", priority: 0.5 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.4 },
  { path: "/pqr", changeFrequency: "yearly", priority: 0.4 },
];

async function productPages(): Promise<
  Array<{ url: string; lastModified: Date }>
> {
  if (!isProductionDeployment()) return [];

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true);

    return (data ?? []).map((product) => ({
      url: `${getSiteUrl()}/producto/${product.slug}`,
      lastModified: product.updated_at
        ? new Date(product.updated_at)
        : new Date(site.legal.policyVersion),
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const updatedAt = new Date(site.legal.policyVersion);

  const products = await productPages();

  return [
    ...staticPages.map(({ path, changeFrequency, priority }) => ({
      url: `${base}${path}`,
      lastModified: updatedAt,
      changeFrequency,
      priority,
    })),
    ...products.map((product) => ({
      url: product.url,
      lastModified: product.lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
