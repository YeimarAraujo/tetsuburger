"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AddonTarget } from "@/lib/addons";
import { addonCharged } from "@/lib/addons";

export interface CartAddon {
  id: string;
  name: string;
  price: number;
  /** Cuántas unidades de la adición (por ejemplo 2× tocineta). 1 si se omite. */
  quantity?: number;
  /** En combos: "EACH" (a cada producto), "HAMBURGUESA" o "PERRO". */
  target?: AddonTarget;
  /** Número de productos del combo cuando target === "EACH". */
  components?: number;
}

export interface CartItem {
  /** Identifica la combinación producto + adicionales (cantidad, a dónde aplica). */
  key: string;
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  addons: CartAddon[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "key">) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}

function addonSegment(a: CartAddon): string {
  const qty = a.quantity ?? 1;
  const target = a.target ? `:${a.target}` : "";
  const components = a.target === "EACH" ? `:${a.components ?? 1}` : "";
  return `${a.id}>${qty}${target}${components}`;
}

export function itemKey(productId: string, addons: CartAddon[]): string {
  return `${productId}__${addons.map(addonSegment).sort().join(",")}`;
}

export function itemUnitPrice(item: CartItem): number {
  return (
    item.price + item.addons.reduce((sum, a) => sum + addonCharged(a), 0)
  );
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + itemUnitPrice(item) * item.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const key = itemKey(item.productId, item.addons);
          const existing = state.items.find((i) => i.key === key);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: i.quantity + item.quantity } : i
              ),
            };
          }

          return { items: [...state.items, { ...item, key }] };
        }),

      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "tetsuburger-cart",
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          const stale = persisted as { items?: CartItem[] };
          const items = (stale.items ?? [])
            .map((i) => ({
              ...i,
              addons: (i.addons ?? []).map((a) => ({ ...a, quantity: 1 })),
            }))
            .map((i) => ({
              ...i,
              key: itemKey(i.productId, i.addons),
            }));
          return { items };
        }
        return persisted as CartState;
      },
    }
  )
);