// Tema estacional del sitio (apariencia) — parte pura, usable en cliente y servidor.
//
// El admin elige el tema en /admin/apariencia (clave `site_theme`):
//   - "navidad" / "normal": se fuerza ese tema.
//   - "auto" (o sin definir): Navidad del 1 de diciembre al 6 de enero
//     (hora de Bogotá) y diseño normal el resto del año. Si en el entorno está
//     TEMA_SITIO = "navidad" | "normal", ese valor reemplaza a la fecha.
//
// Logos y mascota por tema también se suben desde el panel (claves
// `appearance_*`); si falta alguno se usa el archivo de `public/images`.

const TIMEZONE = "America/Bogota";

export type SiteTheme = "normal" | "navidad";
export type SiteThemeSetting = SiteTheme | "auto";

export interface ImageRef {
  src: string;
  width: number;
  height: number;
  /** Factor de tamaño al mostrarla (1 si no se indica). */
  scale?: number;
}

// El gorro suma altura al logo navideño: se muestra un 20 % más grande para que
// las letras queden del mismo tamaño que en el logo normal (proporción 2,68/2,22).
const LOGO_HAT_SCALE = 1.2;

export interface SiteAppearance {
  theme: SiteTheme;
  /** Logo para fondos claros (header, admin, login, aviso de cerrado). */
  logo: ImageRef;
  /** Logo para fondos oscuros (footer). */
  logoLight: ImageRef;
  /** Mascota de la portada. */
  mascot: ImageRef;
}

export const APPEARANCE_THEME_KEY = "site_theme";

export const APPEARANCE_SLOTS = [
  "logo_normal",
  "logo_navidad",
  "logo_blanco_normal",
  "logo_blanco_navidad",
  "mascota_normal",
  "mascota_navidad",
] as const;

export type AppearanceSlot = (typeof APPEARANCE_SLOTS)[number];

export function appearanceSettingKey(slot: AppearanceSlot): string {
  return `appearance_${slot}`;
}

export function isAppearanceSlot(value: unknown): value is AppearanceSlot {
  return (
    typeof value === "string" &&
    (APPEARANCE_SLOTS as readonly string[]).includes(value)
  );
}

/** Archivos de `public/images` que se usan cuando no hay imagen subida. */
export const DEFAULT_IMAGES: Record<AppearanceSlot, ImageRef> = {
  logo_normal: { src: "/images/logo.webp", width: 483, height: 180 },
  logo_navidad: {
    src: "/images/LogoNavidad.webp",
    width: 960,
    height: 433,
    scale: LOGO_HAT_SCALE,
  },
  logo_blanco_normal: { src: "/images/logoWhite.webp", width: 483, height: 180 },
  logo_blanco_navidad: {
    src: "/images/LogoNavidadWhite.webp",
    width: 960,
    height: 433,
    scale: LOGO_HAT_SCALE,
  },
  mascota_normal: { src: "/images/tetsitoHero.webp", width: 443, height: 432 },
  mascota_navidad: {
    src: "/images/tetsitoNavidadHero.webp",
    width: 443,
    height: 496,
  },
};

function isChristmasSeason(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return month === 12 || (month === 1 && day <= 6);
}

export function parseThemeSetting(value: unknown): SiteThemeSetting {
  return value === "normal" || value === "navidad" ? value : "auto";
}

export function resolveSiteTheme(
  setting: SiteThemeSetting,
  now: Date = new Date()
): SiteTheme {
  if (setting !== "auto") return setting;
  const forced = process.env.TEMA_SITIO?.trim().toLowerCase();
  if (forced === "navidad" || forced === "normal") return forced;
  return isChristmasSeason(now) ? "navidad" : "normal";
}

/** Lee `{ url, width, height }` guardado en settings; null si no es válido. */
export function parseImageRef(value: unknown): ImageRef | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const url = typeof v.url === "string" ? v.url : "";
  const width = Number(v.width);
  const height = Number(v.height);
  if (!/^https:\/\//.test(url)) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 16 || height < 16 || width > 10000 || height > 10000) return null;
  return { src: url, width, height };
}

/** Arma la apariencia final a partir de los valores de `settings`. */
export function buildSiteAppearance(
  values: Record<string, unknown>,
  now: Date = new Date()
): SiteAppearance {
  const theme = resolveSiteTheme(
    parseThemeSetting(values[APPEARANCE_THEME_KEY]),
    now
  );

  // Imagen subida desde el panel o, si no hay, la de `public/images`.
  const pick = (slot: AppearanceSlot): ImageRef =>
    parseImageRef(values[appearanceSettingKey(slot)]) ?? DEFAULT_IMAGES[slot];

  return theme === "navidad"
    ? {
        theme,
        logo: pick("logo_navidad"),
        logoLight: pick("logo_blanco_navidad"),
        mascot: pick("mascota_navidad"),
      }
    : {
        theme,
        logo: pick("logo_normal"),
        logoLight: pick("logo_blanco_normal"),
        mascot: pick("mascota_normal"),
      };
}
