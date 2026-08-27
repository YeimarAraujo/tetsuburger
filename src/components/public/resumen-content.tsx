"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { useCart, cartSubtotal, cartCount, itemUnitPrice } from "@/store/cart";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FloatingCartButton } from "@/components/public/floating-cart-button";

export function ResumenContent({ deliveryFee }: { deliveryFee: number }) {
  const items = useCart((s) => s.items);
  const removeItem = useCart((s) => s.removeItem);
  const subtotal = cartSubtotal(items);
  const count = cartCount(items);
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-medium">Tu carrito está vacío</p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="outline">Volver al menú</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="rounded-lg border p-2 transition-colors hover:bg-muted">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Resumen del pedido</h1>
          <p className="text-sm text-muted-foreground">{count} {count === 1 ? "producto" : "productos"}</p>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-3 p-4">
              {item.imageUrl ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="size-14 shrink-0 rounded-lg border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    {item.addons.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        + {item.addons.map((a) => a.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-bold">
                    {formatCOP(itemUnitPrice(item) * item.quantity)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {item.quantity} × {formatCOP(itemUnitPrice(item))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-destructive transition-opacity hover:opacity-70"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCOP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Domicilio</span>
            <span>{deliveryFee > 0 ? formatCOP(deliveryFee) : "Gratis"}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCOP(total)}</span>
          </div>

          <Link href="/checkout" className="block pt-2">
            <Button size="lg" className="w-full gap-2">
              <Pencil className="size-4" />
              Continuar pedido
            </Button>
          </Link>

          <Link href="/" className="block text-center text-sm text-muted-foreground hover:text-primary">
            <div className="flex items-center justify-center gap-2">
              <ChevronLeft className="size-4" /> Seguir pidiendo
            </div>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
