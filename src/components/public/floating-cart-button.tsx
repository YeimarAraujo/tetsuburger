"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart, cartCount, cartSubtotal } from "@/store/cart";
import { formatCOP } from "@/lib/format";

export function FloatingCartButton() {
  const items = useCart((s) => s.items);
  const count = cartCount(items);

  if (count === 0) return null;

  return (
    <Link
      href="/checkout"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
    >
      <ShoppingBag className="size-5" />
      <span>Ver pedido</span>
      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">
        {count}
      </span>
      <span className="border-l border-white/30 pl-3">
        {formatCOP(cartSubtotal(items))}
      </span>
    </Link>
  );
}
