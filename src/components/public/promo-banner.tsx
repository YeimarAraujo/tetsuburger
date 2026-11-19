import { Gift, Truck } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { bannerHighlights, type PublicPromotion } from "@/lib/promotions";

/**
 * Franja del inicio con las promociones por monto. Solo anuncia el escalón más
 * bajo de cada tipo y dice que hay un regalo, nunca cuál.
 *
 * El monto se muestra como "mayores a X-1": las compras son en pesos enteros,
 * así que "mayor a $49.999" equivale a "desde $50.000".
 */
export function PromoBanner({ promos }: { promos: PublicPromotion[] }) {
  const { giftFrom, freeDeliveryFrom } = bannerHighlights(promos);
  if (giftFrom === null && freeDeliveryFrom === null) return null;

  return (
    <section aria-label="Promociones" className="border-b bg-primary/10">
      {/* Móvil: una promoción por línea. Desde sm: todo en una sola fila. */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-0.5 px-4 py-2 text-center text-xs font-semibold sm:flex-row sm:justify-center sm:gap-x-8 sm:text-sm">
        {giftFrom !== null ? (
          <p className="flex items-center gap-1.5">
            <Gift className="size-3.5 shrink-0 text-price sm:size-4" aria-hidden="true" />
            <span>Regalo en compras mayores a {formatCOP(giftFrom - 1)}</span>
          </p>
        ) : null}
        {freeDeliveryFrom !== null ? (
          <p className="flex items-center gap-1.5">
            <Truck className="size-3.5 shrink-0 text-price sm:size-4" aria-hidden="true" />
            <span>Domicilio gratis en compras mayores a {formatCOP(freeDeliveryFrom - 1)}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
