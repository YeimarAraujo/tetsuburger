/**
 * Promociones por monto (regalo sorpresa y domicilio gratis).
 *
 * Lógica pura, sin acceso a base de datos, para poder usarla en el servidor
 * (decide el pedido real) y en el navegador (barra de progreso, avisos).
 *
 * El monto que cuenta es el SUBTOTAL: productos + adicionales, sin domicilio.
 * Las reglas se acumulan: el domicilio gratis lo da cualquier regla alcanzada;
 * el regalo sale de la regla alcanzada de mayor monto que tenga algún regalo
 * disponible, sorteado al azar entre los que tengan stock.
 */

/** Lo que ve el público: montos y beneficios, nunca cuál es el regalo. */
export interface PublicPromotion {
  minTotal: number;
  freeDelivery: boolean;
  hasGift: boolean;
}

export type PromoDeliveryType = "DOMICILIO" | "RECOGIDA" | "LOCAL";

export interface Benefits {
  gift: boolean;
  freeDelivery: boolean;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza la respuesta JSON de get_public_promotions(). */
export function parsePublicPromotions(raw: unknown): PublicPromotion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        minTotal: toNum(row.min_total),
        freeDelivery: row.free_delivery === true,
        hasGift: row.has_gift === true,
      };
    })
    .filter((p) => p.minTotal > 0 && (p.freeDelivery || p.hasGift))
    .sort((a, b) => a.minTotal - b.minTotal);
}

/**
 * Beneficios ya alcanzados con este subtotal. En recogida no hay domicilio, así
 * que el domicilio gratis no cuenta.
 */
export function unlockedBenefits(
  promos: PublicPromotion[],
  subtotal: number,
  deliveryType: PromoDeliveryType = "DOMICILIO"
): Benefits {
  const reached = promos.filter((p) => subtotal >= p.minTotal);
  return {
    gift: reached.some((p) => p.hasGift),
    freeDelivery:
      deliveryType === "DOMICILIO" && reached.some((p) => p.freeDelivery),
  };
}

/**
 * Lo que anuncia el banner: solo el monto más bajo de cada tipo de beneficio.
 * Si hay regalos desde $50.000 y desde $100.000, se anuncia "desde $50.000";
 * el resto de escalones no se menciona.
 */
export function bannerHighlights(promos: PublicPromotion[]): {
  giftFrom: number | null;
  freeDeliveryFrom: number | null;
} {
  const lowest = (pick: (p: PublicPromotion) => boolean): number | null => {
    const amounts = promos.filter(pick).map((p) => p.minTotal);
    return amounts.length > 0 ? Math.min(...amounts) : null;
  };
  return {
    giftFrom: lowest((p) => p.hasGift),
    freeDeliveryFrom: lowest((p) => p.freeDelivery),
  };
}

/**
 * Avance del cliente en UN beneficio. El regalo y el domicilio gratis son
 * independientes: cada uno tiene su propia pista, así que siempre se ve cuánto
 * falta para el domicilio aunque aún falte el regalo (y al revés).
 */
export interface PromoTrack {
  kind: "gift" | "delivery";
  /** Ya se alcanzó al menos un escalón de este beneficio. */
  unlocked: boolean;
  /**
   * Próximo escalón por alcanzar, o null si ya no hay más. Con un regalo ya
   * ganado, es el escalón de un regalo mejor.
   */
  next: { minTotal: number; remaining: number } | null;
  /** Hay más de un escalón de regalo (para poder hablar de "uno mejor"). */
  hasTiers: boolean;
}

/**
 * Pistas de progreso: regalo y domicilio gratis. En recogida no hay pista de
 * domicilio. El domicilio gratis no tiene "mejor": una vez ganado, no hay más.
 */
export function promoTracks(
  promos: PublicPromotion[],
  subtotal: number,
  deliveryType?: PromoDeliveryType
): PromoTrack[] {
  const build = (
    kind: PromoTrack["kind"],
    pick: (p: PublicPromotion) => boolean
  ): PromoTrack | null => {
    const tiers = promos
      .filter(pick)
      .map((p) => p.minTotal)
      .sort((a, b) => a - b);
    if (tiers.length === 0) return null;

    const unlocked = tiers.some((t) => t <= subtotal);
    const nextTier = tiers.find((t) => t > subtotal);

    return {
      kind,
      unlocked,
      next:
        nextTier !== undefined && (kind === "gift" || !unlocked)
          ? { minTotal: nextTier, remaining: nextTier - subtotal }
          : null,
      hasTiers: tiers.length > 1,
    };
  };

  const wantsDelivery = deliveryType === undefined || deliveryType === "DOMICILIO";
  return [
    build("gift", (p) => p.hasGift),
    wantsDelivery ? build("delivery", (p) => p.freeDelivery) : null,
  ].filter((t): t is PromoTrack => t !== null);
}

/** Reglas completas, solo servidor: incluyen los regalos posibles. */
export interface PromotionRule {
  id: string;
  minTotal: number;
  freeDelivery: boolean;
  gifts: { productId: string; productName: string }[];
}

export interface GiftChoice {
  productId: string;
  productName: string;
}

export interface ResolvedPromotions {
  freeDelivery: boolean;
  gift: GiftChoice | null;
}

/** Reglas alcanzadas con este subtotal, de mayor a menor monto. */
export function applicableRules(
  rules: PromotionRule[],
  subtotal: number
): PromotionRule[] {
  return rules
    .filter((r) => r.minTotal > 0 && subtotal >= r.minTotal)
    .sort((a, b) => b.minTotal - a.minTotal);
}

/**
 * Decide qué se otorga a un pedido.
 * `hasStock` dice si un producto de regalo se puede entregar; `random(n)` debe
 * devolver un entero en [0, n). Se inyectan para poder probar la lógica.
 */
export function resolvePromotions(
  rules: PromotionRule[],
  subtotal: number,
  deliveryType: PromoDeliveryType,
  hasStock: (productId: string) => boolean,
  random: (n: number) => number
): ResolvedPromotions {
  const applicable = applicableRules(rules, subtotal);

  const freeDelivery =
    deliveryType === "DOMICILIO" && applicable.some((r) => r.freeDelivery);

  let gift: GiftChoice | null = null;
  for (const rule of applicable) {
    const candidates = rule.gifts.filter((g) => hasStock(g.productId));
    if (candidates.length === 0) continue;
    gift = candidates[random(candidates.length)] ?? candidates[0];
    break;
  }

  return { freeDelivery, gift };
}
