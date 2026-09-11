export type AddonTarget = "EACH" | "HAMBURGUESA" | "PERRO";

export interface AddedAddon {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  target?: AddonTarget;
  /** Número de productos del combo (solo cuando target === "EACH"). */
  components?: number;
}

export function addonQty(a: AddedAddon): number {
  return a.quantity ?? 1;
}

/** Precio efectivo cobrado por la adición según cantidad y a dónde aplica. */
export function addonCharged(a: AddedAddon): number {
  return a.price * addonQty(a) * (a.target === "EACH" ? (a.components ?? 1) : 1);
}

export function addonLabel(a: AddedAddon): string {
  const qty = addonQty(a);
  const base = qty > 1 ? `${qty}× ${a.name}` : a.name;
  if (a.target === "EACH") return `${base} (a cada producto del combo)`;
  if (a.target === "HAMBURGUESA") return `${base} (a la hamburguesa)`;
  if (a.target === "PERRO") return `${base} (al perro)`;
  return base;
}