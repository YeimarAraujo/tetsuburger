"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart, cartCount, cartSubtotal } from "@/store/cart";
import { formatCOP } from "@/lib/format";

export function FloatingCartButton() {
  const items = useCart((s) => s.items);
  const count = cartCount(items);

  if (count === 0) return null;

  return (
    <Link
      href="/resumen"
      aria-label={`Ver pedido: ${count} ${count === 1 ? "producto" : "productos"}, ${formatCOP(cartSubtotal(items))}`}
      // En móvil deja libre la esquina derecha para el botón de WhatsApp.
      className="fixed bottom-5 left-4 right-20 z-50 flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-primary px-3 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:gap-3 sm:px-6"
    >
      <ShoppingCart className="size-5 shrink-0" />
      <span>Ver pedido</span>
      <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs">
        {count}
      </span>
      <span className="border-l border-primary-foreground/25 pl-2 sm:pl-3">
        {formatCOP(cartSubtotal(items))}
      </span>
    </Link>
  );
}
