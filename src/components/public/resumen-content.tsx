"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronLeft, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCart, cartSubtotal, cartCount, itemUnitPrice } from "@/store/cart";
import { addonLabel } from "@/lib/addons";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductCard, type ProductCardData } from "@/components/public/product-card";
import { TrackView } from "@/components/public/track-view";

export interface CatalogEntry {
  card: ProductCardData;
  categoryId: string;
  /** Posición de la categoría en el menú (display_order). */
  categoryOrder: number;
}

const MAX_SUGGESTIONS = 3;

/**
 * Sugerencias para completar el pedido: productos que no están en el carrito,
 * primero los de categorías que el cliente aún no tiene (si pidió
 * hamburguesas, aparecen bebidas o acompañamientos), luego los más baratos.
 */
function pickSuggestions(catalog: CatalogEntry[], productIdsInCart: Set<string>): ProductCardData[] {
  const cartCategories = new Set(
    catalog.filter((c) => productIdsInCart.has(c.card.id)).map((c) => c.categoryId)
  );

  return catalog
    .filter((c) => !productIdsInCart.has(c.card.id) && c.card.isAvailable)
    .sort(
      (a, b) =>
        Number(cartCategories.has(a.categoryId)) - Number(cartCategories.has(b.categoryId)) ||
        a.categoryOrder - b.categoryOrder ||
        a.card.price - b.card.price
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => c.card);
}

export function ResumenContent({
  deliveryFee,
  deliveryFeeAconvenir,
  catalog,
}: {
  deliveryFee: number;
  deliveryFeeAconvenir?: boolean;
  catalog: CatalogEntry[];
}) {
  const items = useCart((s) => s.items);
  const removeItem = useCart((s) => s.removeItem);
  const setQuantity = useCart((s) => s.setQuantity);
  const subtotal = cartSubtotal(items);
  const count = cartCount(items);
  // El evento se registra una vez con el carrito con el que se llegó.
  const [initialCart] = useState(() => ({ items: count, total: subtotal }));

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Tu carrito está vacío</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Agrega algo rico del menú y vuelve aquí para revisar tu pedido.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/#menu">Ver el menú</Link>
        </Button>
      </main>
    );
  }

  const suggestions = pickSuggestions(catalog, new Set(items.map((i) => i.productId)));
  const continueLabel = `Continuar con el pedido · ${formatCOP(subtotal)}`;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <TrackView event="view_cart" data={initialCart} />

      <div className="flex items-center gap-3">
        <Link
          href="/#menu"
          aria-label="Volver al menú"
          className="rounded-lg border bg-background p-2 transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Tu pedido</h1>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "producto" : "productos"}
          </p>
        </div>
      </div>

      {/* Productos */}
      <Card>
        <CardContent className="divide-y p-0">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-3 p-4">
              {item.imageUrl ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border">
                  <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                </div>
              ) : (
                <div className="size-14 shrink-0 rounded-lg border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name}</p>
                    {item.addons.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        + {item.addons.map((a) => addonLabel(a)).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="grid size-9 shrink-0 place-items-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                    aria-label={`Eliminar ${item.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatCOP(itemUnitPrice(item))} c/u
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center rounded-full border bg-background">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        className="flex size-9 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                        disabled={item.quantity <= 1}
                        aria-label={`Quitar uno de ${item.name}`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-7 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                        className="flex size-9 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:bg-muted"
                        aria-label={`Agregar uno de ${item.name}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="min-w-20 whitespace-nowrap text-right font-bold tabular-nums">
                      {formatCOP(itemUnitPrice(item) * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex justify-between text-base font-bold">
            <span>Subtotal</span>
            <span className="tabular-nums text-price">{formatCOP(subtotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {deliveryFeeAconvenir
              ? "Si es a domicilio, el valor se confirma por WhatsApp según tu zona."
              : deliveryFee > 0
                ? `Si es a domicilio se suman ${formatCOP(deliveryFee)}. Pasando a recoger no tiene costo.`
                : "Eliges domicilio o recogida en el siguiente paso."}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href="/#menu">
                <Plus className="size-4" />
                Seguir comprando
              </Link>
            </Button>
            <Button asChild className="h-11 gap-2">
              <Link href="/checkout">
                Continuar
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agregar más sin volver al menú */}
      {suggestions.length > 0 ? (
        <section aria-labelledby="suggestions-title" className="space-y-3">
          <div>
            <h2 id="suggestions-title" className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="size-4 text-price" />
              ¿Le sumamos algo?
            </h2>
            <p className="text-sm text-muted-foreground">
              Agrégalo aquí mismo, sin volver al menú.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {suggestions.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/#menu"
              className="text-sm font-medium text-price hover:underline"
            >
              Ver todo el menú
            </Link>
            <Button asChild className="h-11 gap-2">
              <Link href="/checkout">
                {continueLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
