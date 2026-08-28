"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Loader2, Plus, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import type { CartAddon } from "@/store/cart";
import { useCart } from "@/store/cart";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ProductCardData {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  addons: (CartAddon & { available?: boolean })[];
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { addItem } = useCart();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const soldOut = !product.isAvailable;

  function addDirect() {
    setAdding(true);
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: 1,
      addons: [],
    });
    toast.success(`${product.name} agregado al carrito`);
    setTimeout(() => setAdding(false), 400);
  }

  function addWithAddons() {
    const addons = product.addons.filter((a) => selected.includes(a.id));
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: 1,
      addons,
    });
    toast.success(`${product.name} agregado al carrito`);
    setDialogOpen(false);
    setSelected([]);
  }

  return (
    <>
      <div className="group flex gap-4 rounded-2xl border bg-card p-3 transition-all sm:p-4">
        {/* Imagen del producto */}
        {product.imageUrl ? (
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            className="relative size-28 shrink-0 overflow-hidden rounded-xl border sm:size-36"
          >
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 112px, 144px"
              className="object-cover transition-transform group-hover:scale-105"
            />
            {soldOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
                  Agotado
                </span>
              </div>
            )}
          </button>
        ) : (
          <div className="size-28 shrink-0 rounded-xl border bg-muted sm:size-36" />
        )}

        {/* Contenido */}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-base font-bold leading-tight sm:text-lg">
            {product.name}
          </h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <span className="text-lg font-bold text-primary sm:text-xl">
              {formatCOP(product.price)}
            </span>

            {soldOut ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
                Agotado
              </span>
            ) : (
              <Button
                size="default"
                disabled={adding}
                onClick={() =>
                  product.addons.length > 0 ? setDialogOpen(true) : addDirect()
                }
                className="gap-1.5"
              >
                {adding ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="size-4" />
                    Agregar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Visor de imagen ampliada */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-lg p-0 sm:max-w-xl">
          <button
            type="button"
            onClick={() => setImageOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
          >
            <X className="size-5" />
          </button>
          <div className="relative aspect-square w-full">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, 576px"
              className="rounded-lg object-contain"
              priority
            />
          </div>
          <div className="space-y-3 p-4">
            <div>
              <DialogTitle className="text-xl">{product.name}</DialogTitle>
              {product.description ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xl font-bold text-primary">
                {formatCOP(product.price)}
              </span>

              {soldOut ? (
                <span className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                  Agotado
                </span>
              ) : (
                <Button
                  size="lg"
                  disabled={adding}
                  onClick={() => {
                    setImageOpen(false);
                    if (product.addons.length > 0) {
                      setDialogOpen(true);
                    } else {
                      addDirect();
                    }
                  }}
                  className="gap-1.5"
                >
                  {adding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Agregar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selector de adicionales */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setSelected([]); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
          </DialogHeader>

          <p className="-mt-1 text-sm font-semibold text-primary">
            {formatCOP(product.price)}
          </p>

          {product.addons.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">¿Quieres agregar algo más?</p>
              {product.addons.map((addon) => {
                const checked = selected.includes(addon.id);
                const noStock = addon.available === false;
                return (
                  <label
                    key={addon.id}
                    className={
                      noStock
                        ? "flex items-center justify-between rounded-lg border border-dashed p-3 text-sm opacity-50"
                        : "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-colors has-[[data-state=checked]]:border-primary"
                    }
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={noStock}
                        onChange={() =>
                          setSelected((prev) =>
                            checked
                              ? prev.filter((id) => id !== addon.id)
                              : [...prev, addon.id]
                          )
                        }
                        className="sr-only"
                        data-state={checked ? "checked" : "unchecked"}
                      />
                      <span
                        className={`flex size-5 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : ""
                          }`}
                      >
                        {checked ? <Check className="size-3.5" /> : null}
                      </span>
                      {addon.name}
                      {noStock ? (
                        <span className="text-[10px] font-semibold text-destructive">
                          Sin stock
                        </span>
                      ) : null}
                    </span>
                    <span className="font-medium text-muted-foreground">
                      +{formatCOP(addon.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <Button size="lg" onClick={addWithAddons}>
            <ShoppingCart className="size-4" />
            Agregar ·{" "}
            {formatCOP(
              product.price +
              product.addons
                .filter((a) => selected.includes(a.id))
                .reduce((s, a) => s + a.price, 0)
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
