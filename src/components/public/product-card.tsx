"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import type { CartAddon } from "@/store/cart";
import { useCart } from "@/store/cart";
import { addonCharged } from "@/lib/addons";
import type { AddonTarget } from "@/lib/addons";
import type { AddonTipo } from "@/types/db";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
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
  /** Suma de conteos >= 2 ⇒ se trata como combo. */
  isCombo: boolean;
  hamburguesas: number;
  perros: number;
  addons: (CartAddon & { available?: boolean; tipo?: AddonTipo })[];
}

interface AddonSel {
  qty: number;
  /** "Añadir una adición a cada producto del combo" */
  each: boolean;
  slot: "HAMBURGUESA" | "PERRO";
}

const MAX_ADDON_QTY = 10;

export function ProductCard({ product }: { product: ProductCardData }) {
  const { addItem } = useCart();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [sel, setSel] = useState<Record<string, AddonSel>>({});
  const [adding, setAdding] = useState(false);

  const soldOut = !product.isAvailable;
  const hasMix = product.isCombo && product.hamburguesas > 0 && product.perros > 0;
  const components = product.hamburguesas + product.perros;

  function resetSel() {
    setSel({});
  }

  function bump(id: string, delta: number) {
    setSel((prev) => {
      const cur = prev[id]?.qty ?? 0;
      const qty = Math.min(MAX_ADDON_QTY, Math.max(0, cur + delta));
      if (qty === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return {
        ...prev,
        [id]: {
          qty,
          each: prev[id]?.each ?? false,
          slot: prev[id]?.slot ?? "HAMBURGUESA",
        },
      };
    });
  }

  function setEach(id: string, each: boolean) {
    setSel((prev) =>
      prev[id] && prev[id].qty > 0
        ? { ...prev, [id]: { ...prev[id], each } }
        : prev
    );
  }

  function setSlot(id: string, slot: "HAMBURGUESA" | "PERRO") {
    setSel((prev) =>
      prev[id] && prev[id].qty > 0
        ? { ...prev, [id]: { ...prev[id], slot, each: false } }
        : prev
    );
  }

  function selectionOn(addon: CartAddon): CartAddon | null {
    const s = sel[addon.id];
    if (!s || s.qty <= 0) return null;
    const esAlimento = (addon as { tipo?: AddonTipo }).tipo !== "ACOMPAÑAMIENTO";
    const target: AddonTarget | undefined = esAlimento
      ? s.each
        ? "EACH"
        : product.isCombo && hasMix
          ? (s.slot as AddonTarget)
          : undefined
      : undefined;
    return {
      id: addon.id,
      name: addon.name,
      price: addon.price,
      quantity: s.qty,
      target,
      components: target === "EACH" ? components : undefined,
    };
  }

  function addOnes(addons: CartAddon[]) {
    return addons
      .map((a) => selectionOn(a))
      .filter((a): a is CartAddon => a !== null);
  }

  function addonsTotal(addons: CartAddon[]): number {
    return addOnes(addons).reduce((s, a) => s + addonCharged(a), 0);
  }

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
    const addons = addOnes(product.addons);
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
    resetSel();
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
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetSel();
        }}
      >
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
          </DialogHeader>

          <p className="-mt-1 text-sm font-semibold text-primary">
            {formatCOP(product.price)}
          </p>

          {product.isCombo ? (
            <p className="-mt-2 flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span>
                Combo: {product.hamburguesas} {product.hamburguesas === 1 ? "hamburguesa" : "hamburguesas"} ·{" "}
                {product.perros} {product.perros === 1 ? "perro" : "perros"}
              </span>
              <InfoTip
                content={{
                  title: "Adiciones en combos",
                  what: "Puedes añadir una adición a cada producto del combo, o elegir a la hamburguesa o al perro.",
                  suggestion: `Cada unidad extra se cobra por separado. "A cada producto" aplica y cobra a los ${components} productos del combo.`,
                }}
              />
            </p>
          ) : null}

          {product.addons.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">¿Quieres agregar algo más?</p>
              {product.addons.map((addon) => {
                const noStock = addon.available === false;
                const state = sel[addon.id];
                const qty = state?.qty ?? 0;
                const each = state?.each ?? false;
                return (
                  <div
                    key={addon.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm transition-colors",
                      noStock
                        ? "border-dashed opacity-50"
                        : qty > 0
                          ? "border-primary bg-primary/5"
                          : "border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {addon.name}
                          {noStock ? (
                            <span className="ml-2 text-[10px] font-semibold text-destructive">
                              Sin stock
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          +{formatCOP(addon.price)} c/u
                        </p>
                      </div>

                      {/* Stepper de cantidad */}
                      <div
                        className={cn(
                          "flex items-center rounded-full border",
                          noStock && "pointer-events-none opacity-40"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => bump(addon.id, -1)}
                          disabled={qty <= 0 || noStock}
                          className="flex size-8 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                          aria-label={`Quitar ${addon.name}`}
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => bump(addon.id, 1)}
                          disabled={noStock || qty >= MAX_ADDON_QTY}
                          className="flex size-8 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                          aria-label={`Añadir ${addon.name}`}
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>

                    {product.isCombo && qty > 0 && addon.tipo !== "ACOMPAÑAMIENTO" ? (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={each}
                            onChange={(e) => setEach(addon.id, e.target.checked)}
                            className="size-4"
                          />
                          Añadir una adición a cada producto del combo
                        </label>

                        {!each && hasMix ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Destino:
                            </span>
                            <div className="flex overflow-hidden rounded-lg border">
                              <button
                                type="button"
                                onClick={() => setSlot(addon.id, "HAMBURGUESA")}
                                className={cn(
                                  "px-3 py-1 text-xs font-semibold transition-colors",
                                  state?.slot === "HAMBURGUESA"
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted"
                                )}
                              >
                                La hamburguesa
                              </button>
                              <button
                                type="button"
                                onClick={() => setSlot(addon.id, "PERRO")}
                                className={cn(
                                  "border-l px-3 py-1 text-xs font-semibold transition-colors",
                                  state?.slot === "PERRO"
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted"
                                )}
                              >
                                El perro
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {each ? (
                          <p className="text-[11px] text-muted-foreground">
                            {qty} {qty === 1 ? "unidad" : "unidades"} ×{" "}
                            {components} productos ={" "}
                            <span className="font-semibold text-foreground">
                              {formatCOP(addon.price * qty * components)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {qty} {qty === 1 ? "unidad" : "unidades"} ={" "}
                            <span className="font-semibold text-foreground">
                              {formatCOP(addon.price * qty)}
                            </span>
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <Button size="lg" onClick={addWithAddons}>
            <ShoppingCart className="size-4" />
            Agregar · {formatCOP(product.price + addonsTotal(product.addons))}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}