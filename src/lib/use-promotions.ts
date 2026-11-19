"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parsePublicPromotions, type PublicPromotion } from "@/lib/promotions";

/**
 * Promociones públicas (montos y beneficios, nunca cuál es el regalo) para
 * componentes de cliente que no las reciben del servidor, como el panel del
 * carrito del Header, que está en varias páginas. Se piden una vez por visita y
 * se guardan en memoria unos minutos.
 */

const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; promos: PublicPromotion[] } | null = null;
let inflight: Promise<PublicPromotion[]> | null = null;

function loadPromotions(): Promise<PublicPromotion[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.promos);
  if (inflight) return inflight;

  inflight = Promise.resolve(createClient().rpc("get_public_promotions"))
    .then(({ data, error }) => {
      // Si falla, el carrito simplemente no muestra promociones.
      const promos = error ? [] : parsePublicPromotions(data);
      cache = { at: Date.now(), promos };
      return promos;
    })
    .catch(() => [] as PublicPromotion[])
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function usePromotions(): PublicPromotion[] {
  const [promos, setPromos] = useState<PublicPromotion[]>([]);

  useEffect(() => {
    let active = true;
    loadPromotions().then((loaded) => {
      if (active) setPromos(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return promos;
}
