/**
 * URL canónica del sitio.
 *
 * Orden de resolución:
 * 1. `NEXT_PUBLIC_SITE_URL` (dominio propio configurado en Vercel).
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` (dominio de producción del proyecto).
 * 3. `http://localhost:3000` en desarrollo.
 */

function normalize(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim()) return normalize(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel && vercel.trim()) return normalize(vercel);

  return "http://localhost:3000";
}

/** `true` en producción (Vercel). En preview/desarrollo no se indexa. */
export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production" && !process.env.CI_PREVIEW;
}
