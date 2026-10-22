/**
 * Fuente única de los datos públicos del negocio.
 *
 * Los campos que aún no existen se modelan como `null` y la UI los omite
 * (nunca se inventan valores). `legalName` se conserva para uso interno y
 * trámites, pero no se muestra en el sitio. `isLegalDraft` controla la banda
 * de borrador y el `noindex` de las páginas legales.
 */

export const site = {
  name: "TETSU BURGER",
  tagline: "Sazón sobre la plancha",

  legalName: "Yeimar Araujo" as string | null,
  taxId: null as string | null,
  publicAddress: null as string | null,

  city: "Valledupar",
  region: "Cesar",
  country: "CO",
  countryName: "Colombia",
  serviceArea: "Valledupar, Cesar, Colombia",
  deliveryOnly: true,

  whatsapp: "573044243650",
  phone: "+57 304 424 3650",
  email: "tetsuburger@gmail.com",
  privacyEmail: "tetsuburger@gmail.com",
  pqrEmail: "tetsuburger@gmail.com",

  social: {
    instagram: "https://www.instagram.com/tetsu.burger/",
    facebook: null as string | null,
    googleBusiness: null as string | null,
  },

  legal: {
    policyVersion: "2026-10-22",
  },

  /** Se muestra solo si el dueño confirma un rango real. */
  estimatedDeliveryTime: null as string | null,

  priceRange: "$$",
  cuisines: ["Hamburguesas", "Perros calientes", "Comida rápida"],
} as const;

const UNRESOLVED = "TODO_";

/** `true` mientras falte cualquier dato obligatorio del titular. */
export function isLegalDraft(): boolean {
  return !site.legalName || site.legalName.startsWith(UNRESOLVED);
}

/**
 * Datos del titular que solo se renderizan cuando existen.
 * `legalName` se omite a propósito: es información interna.
 */
export function legalIdentityLines(): string[] {
  const lines: string[] = [];
  if (site.taxId && !site.taxId.startsWith(UNRESOLVED)) {
    lines.push(`NIT: ${site.taxId}`);
  }
  if (site.publicAddress && !site.publicAddress.startsWith(UNRESOLVED)) {
    lines.push(`Dirección: ${site.publicAddress}`);
  }
  lines.push(`Domicilio: ${site.city}, ${site.region}, ${site.countryName}`);
  return lines;
}
