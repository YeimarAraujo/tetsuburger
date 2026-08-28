export const UNITS = [
  "unidad",
  "kg",
  "gramos",
  "libra",
  "litro",
  "ml",
  "paquete",
  "caja",
  "docena",
  "lonja",
  "tira",
  "bolsa",
  "pote",
  "botella",
  "sobre",
] as const;

export type Unit = (typeof UNITS)[number];

export function isKnownUnit(value: string): boolean {
  return (UNITS as readonly string[]).includes(value);
}
