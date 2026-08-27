"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useCart, cartCount, cartSubtotal } from "@/store/cart";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function CartLines() {
  const { items, setQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <ShoppingCart className="size-10 text-muted-foreground/40" />
        <p className="font-medium">Tu carrito está vacío</p>
        <p className="text-sm text-muted-foreground">¡Agrega algo rico del menú!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 divide-y overflow-y-auto px-4">
      {items.map((item) => (
        <div key={item.key} className="flex gap-3 py-3">
          {item.imageUrl ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-md border">
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="size-14 shrink-0 rounded-md border bg-muted" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            {item.addons.length > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                + {item.addons.map((a) => a.name).join(", ")}
              </p>
            ) : null}
            <p className="mt-0.5 text-sm font-semibold text-primary">
              {formatCOP(item.price + item.addons.reduce((s, a) => s + a.price, 0))}
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => setQuantity(item.key, item.quantity - 1)}
                aria-label="Quitar uno"
              >
                −
              </Button>
              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => setQuantity(item.key, item.quantity + 1)}
                aria-label="Agregar uno"
              >
                +
              </Button>
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="ml-auto text-xs font-medium text-destructive hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            <img src="/images/logo.webp" alt="Logo" className="w-30 h-30" />
          </Link>

          <SheetTrigger asChild>
            <Button variant="outline" size="lg" className="relative gap-2">
              <ShoppingCart className="size-5  " />
              <span className="hidden sm:inline">Carrito</span>
              {count > 0 ? (
                <>
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {count}
                  </span>
                </>
              ) : null}
            </Button>
          </SheetTrigger>
        </div>
      </header>

      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tu pedido</SheetTitle>
        </SheetHeader>
        <CartLines />
        {items.length > 0 ? (
          <SheetFooter className="border-t">
            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatCOP(subtotal)}</span>
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">
                El costo de domicilio se suma en el siguiente paso.
              </p>
              <Link href="/resumen" onClick={() => setOpen(false)} className="block">
                <Button className="w-full" size="lg">
                  Ver pedido · {formatCOP(subtotal)}
                </Button>
              </Link>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
