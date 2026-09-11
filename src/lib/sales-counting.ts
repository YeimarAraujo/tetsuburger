/**
 * Conteo de ventas por tipo de unidad (hamburguesas / perros).
 *
 * Cada producto declara cuántas hamburguesas (conteo_hamburguesas) y perros
 * (conteo_perros) contiene cada unidad vendida. El conteo de una línea de
 * pedido es  cantidad × conteo, y se suma por pedido y por producto.
 *
 * Si un ítem ya no tiene producto vinculado (product_id null), se usa un mapa
 * de respaldo por nombre —los nombres en order_items son snapshots históricos.
 */

export interface SaleLine {
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  lineTotal: number;
}

export interface Breakdown {
  hamburguesas: number;
  perros: number;
}

export interface ProductCountMap {
  [productId: string]: Breakdown;
}

export interface ProductHit {
  name: string;
  units: number;
  hamburguesas: number;
  perros: number;
  ingresos: number;
}

export interface SalesStats {
  totals: Breakdown & { pedidos: number };
  perOrder: Record<string, Breakdown>;
  byProduct: ProductHit[];
}

const NAME_FALLBACK: Record<string, Breakdown> = {
  "Burger clasic": { hamburguesas: 1, perros: 0 },
  "Burger Doble": { hamburguesas: 1, perros: 0 },
  "La tetsu": { hamburguesas: 1, perros: 0 },
  "Perro clasic": { hamburguesas: 0, perros: 1 },
  "Perro Tetsu": { hamburguesas: 0, perros: 1 },
  "Combo #1": { hamburguesas: 2, perros: 0 },
  "Combo #2": { hamburguesas: 1, perros: 1 },
};

function fallbackByName(name: string): Breakdown {
  const exact = NAME_FALLBACK[name];
  if (exact) return exact;
  if (name.toLowerCase().includes("hamburguesa")) return { hamburguesas: 1, perros: 0 };
  if (name.toLowerCase().includes("perro")) return { hamburguesas: 0, perros: 1 };
  return { hamburguesas: 0, perros: 0 };
}

function lineBreakdown(line: SaleLine, productCounts: ProductCountMap): Breakdown {
  const fromProduct = line.productId ? productCounts[line.productId] : undefined;
  const base = fromProduct ?? fallbackByName(line.productName);
  return {
    hamburguesas: base.hamburguesas * line.quantity,
    perros: base.perros * line.quantity,
  };
}

/** Agrega las ventas de las líneas dadas (de pedidos NO cancelados). */
export function countSales(lines: SaleLine[], productCounts: ProductCountMap): SalesStats {
  const totals: Breakdown & { pedidos: number } = { hamburguesas: 0, perros: 0, pedidos: 0 };
  const perOrder: Record<string, Breakdown> = {};
  const hits = new Map<string, ProductHit>();

  for (const line of lines) {
    const { hamburguesas, perros } = lineBreakdown(line, productCounts);

    totals.hamburguesas += hamburguesas;
    totals.perros += perros;

    const order = perOrder[line.orderId] ??= { hamburguesas: 0, perros: 0 };
    order.hamburguesas += hamburguesas;
    order.perros += perros;

    const hit = hits.get(line.productName) ?? {
      name: line.productName,
      units: 0,
      hamburguesas: 0,
      perros: 0,
      ingresos: 0,
    };
    hit.units += line.quantity;
    hit.hamburguesas += hamburguesas;
    hit.perros += perros;
    hit.ingresos += line.lineTotal;
    hits.set(line.productName, hit);
  }

  totals.pedidos = Object.keys(perOrder).length;

  const byProduct = [...hits.values()].sort((a, b) => b.units - a.units);

  return { totals, perOrder, byProduct };
}

/** Conteos de los productos del catálogo (id → hamburguesas/perros). */
export function productCountMap(
  products: { id: string; conteo_hamburguesas: number; conteo_perros: number }[]
): ProductCountMap {
  const map: ProductCountMap = {};
  for (const p of products) {
    map[p.id] = {
      hamburguesas: Number(p.conteo_hamburguesas) || 0,
      perros: Number(p.conteo_perros) || 0,
    };
  }
  return map;
}