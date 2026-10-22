import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { site } from "@/config/site";

const pages: Array<{
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

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const updatedAt = new Date(site.legal.policyVersion);

  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: updatedAt,
    changeFrequency,
    priority,
  }));
}
