/**
 * Análisis de ventas a partir de sales_report() (migración 0033).
 * Solo cuenta pedidos ENTREGADO; "revenue" de un producto incluye sus
 * adicionales y es bruto (los ajustes del valor final se restan en el total).
 */

export interface ReportTotals {
  orders: number;
  gross: number;
  adjustments: number;
  sales: number;
  cost: number;
  units: number;
  hamburguesas: number;
  perros: number;
  in_progress: number;
  cancelled: number;
}

export interface ProductSales {
  key: string;
  product_id: string | null;
  name: string;
  category: string | null;
  units: number;
  orders: number;
  revenue: number;
  cost: number;
  hamburguesas: number;
  perros: number;
}

export interface AddonSales {
  key: string;
  name: string;
  units: number;
  revenue: number;
  cost: number;
}

export interface DailySales {
  date: string;
  orders: number;
  sales: number;
  cost: number;
}

export interface HeatCell {
  /** 0 = domingo … 6 = sábado */
  dow: number;
  hour: number;
  orders: number;
  sales: number;
}

export interface SalesReport {
  totals: ReportTotals;
  products: ProductSales[];
  addons: AddonSales[];
  daily: DailySales[];
  heatmap: HeatCell[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza la respuesta JSON de sales_report (numeric llega como número o texto). */
export function parseSalesReport(raw: unknown): SalesReport {
  const r = (raw ?? {}) as Record<string, unknown>;
  const t = (r.totals ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

  return {
    totals: {
      orders: num(t.orders),
      gross: num(t.gross),
      adjustments: num(t.adjustments),
      sales: num(t.sales),
      cost: num(t.cost),
      units: num(t.units),
      hamburguesas: num(t.hamburguesas),
      perros: num(t.perros),
      in_progress: num(t.in_progress),
      cancelled: num(t.cancelled),
    },
    products: list(r.products).map((p) => ({
      key: String(p.key ?? ""),
      product_id: p.product_id ? String(p.product_id) : null,
      name: String(p.name ?? ""),
      category: p.category ? String(p.category) : null,
      units: num(p.units),
      orders: num(p.orders),
      revenue: num(p.revenue),
      cost: num(p.cost),
      hamburguesas: num(p.hamburguesas),
      perros: num(p.perros),
    })),
    addons: list(r.addons).map((a) => ({
      key: String(a.key ?? ""),
      name: String(a.name ?? ""),
      units: num(a.units),
      revenue: num(a.revenue),
      cost: num(a.cost),
    })),
    daily: list(r.daily).map((d) => ({
      date: String(d.date ?? ""),
      orders: num(d.orders),
      sales: num(d.sales),
      cost: num(d.cost),
    })),
    heatmap: list(r.heatmap).map((h) => ({
      dow: num(h.dow),
      hour: num(h.hour),
      orders: num(h.orders),
      sales: num(h.sales),
    })),
  };
}

export const EMPTY_REPORT: SalesReport = parseSalesReport({});

/* ------------------------------ Períodos ------------------------------ */

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas "YYYY-MM-DD", ambas incluidas. */
export function daysInRange(from: string, to: string): number {
  const ms = new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Período anterior de la misma duración, justo antes de `from`. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = daysInRange(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/** Todas las fechas del rango (para que los días sin ventas aparezcan en 0). */
export function eachDay(from: string, to: string): string[] {
  const days = daysInRange(from, to);
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/** Variación porcentual; null si no hay base para comparar. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/* --------------------------- Matriz de menú --------------------------- */

export type MenuClass = "estrella" | "caballo" | "rompecabezas" | "perro";

export interface MenuItem {
  key: string;
  name: string;
  units: number;
  /** Ganancia por unidad (ingreso − costo) ÷ unidades. */
  marginPerUnit: number;
  /** Participación en unidades vendidas (0–1). */
  mix: number;
  menuClass: MenuClass;
}

/**
 * Ingeniería de menú (Kasavana & Smith): un producto es "popular" si su
 * participación en unidades llega al 70 % de la participación promedio
 * (1/N), y "rentable" si su ganancia por unidad supera el promedio
 * ponderado del menú.
 */
export function classifyMenu(
  products: Pick<ProductSales, "key" | "name" | "units" | "revenue" | "cost">[]
): MenuItem[] {
  const sold = products.filter((p) => p.units > 0);
  const totalUnits = sold.reduce((s, p) => s + p.units, 0);
  if (sold.length === 0 || totalUnits === 0) return [];

  const popularityThreshold = (1 / sold.length) * 0.7;
  const avgMargin = sold.reduce((s, p) => s + (p.revenue - p.cost), 0) / totalUnits;

  return sold.map((p) => {
    const mix = p.units / totalUnits;
    const marginPerUnit = (p.revenue - p.cost) / p.units;
    const popular = mix >= popularityThreshold;
    const profitable = marginPerUnit >= avgMargin;
    const menuClass: MenuClass = popular
      ? profitable
        ? "estrella"
        : "caballo"
      : profitable
        ? "rompecabezas"
        : "perro";
    return { key: p.key, name: p.name, units: p.units, marginPerUnit, mix, menuClass };
  });
}

/* ------------------------- Costos fijos reales ------------------------- */

export interface FixedCostSuggestion {
  nomina: number;
  arriendo: number;
  servicios: number;
  otrosFijos: number;
  /** Categorías que se sumaron en "otros fijos". */
  otrosCategorias: string[];
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Promedio mensual de los gastos reales agrupados como costos fijos.
 * No cuenta materia prima, empaques (ya están en el costo de cada producto)
 * ni entregas (son por pedido, no fijos).
 */
export function suggestFixedCosts(
  expenses: { category: string | null; amount: number; includedInProductCost?: boolean }[],
  months: number
): FixedCostSuggestion {
  const result: FixedCostSuggestion = { nomina: 0, arriendo: 0, servicios: 0, otrosFijos: 0, otrosCategorias: [] };
  const divisor = months > 0 ? months : 1;
  const otros = new Set<string>();

  for (const e of expenses) {
    if (e.includedInProductCost) continue;
    const name = e.category ?? "Sin categoría";
    const n = normalizeName(name);
    if (n.includes("materia prima") || n.includes("empaque") || n.includes("entrega") || n.includes("domicilio")) {
      continue;
    }
    const amount = (Number(e.amount) || 0) / divisor;
    if (n.includes("nomina") || n.includes("sueldo") || n.includes("salario")) result.nomina += amount;
    else if (n.includes("arriendo") || n.includes("alquiler")) result.arriendo += amount;
    else if (n.includes("servicio")) result.servicios += amount;
    else {
      result.otrosFijos += amount;
      otros.add(name);
    }
  }

  result.otrosCategorias = [...otros].sort();
  return result;
}

/* ------------------------------ Gastos ------------------------------ */

export interface ExpenseLike {
  amount: number | string;
  includedInProductCost?: boolean;
}

/**
 * Separa los gastos operativos de los que ya están dentro del costo de cada
 * producto (p. ej. Empaques): esos no se restan otra vez de la utilidad.
 */
export function splitExpenses(expenses: ExpenseLike[]): {
  operating: number;
  includedInCost: number;
} {
  let operating = 0;
  let includedInCost = 0;
  for (const e of expenses) {
    const amount = Number(e.amount) || 0;
    if (e.includedInProductCost) includedInCost += amount;
    else operating += amount;
  }
  return { operating, includedInCost };
}
