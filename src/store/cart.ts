"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  /** Identifica la combinación producto + adicionales */
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

export function itemKey(productId: string, addonIds: string[]): string {
  return `${productId}__${[...addonIds].sort().join(",")}`;
}

export function itemUnitPrice(item: CartItem): number {
  return (
    item.price + item.addons.reduce((sum, a) => sum + a.price, 0)
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
          const key = itemKey(item.productId, item.addons.map((a) => a.id));
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
    { name: "tetsuburger-cart" }
  )
);
