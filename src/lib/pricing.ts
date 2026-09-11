// Meta de food cost: el costo de la materia prima de un producto no debería
// superar el 30% de su precio de venta (estándar del sector gastronómico).
export const TARGET_FOOD_COST = 0.3;

// Precio sugerido = costo / 0.30, redondeado a los $100 para precios limpios.
export function suggestedPrice(cost: number): number {
  if (cost <= 0) return 0;
  return Math.ceil(cost / TARGET_FOOD_COST / 100) * 100;
}

// Porcentaje del precio que representa el costo (food cost %).
export function foodCostPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return (cost / price) * 100;
}

// Utilidad bruta por unidad (venta - costo).
export function grossProfit(price: number, cost: number): number {
  return Math.max(0, price - cost);
}

/* --------------------------- Simulador de costo completo --------------------------- */
// Los costos fijos mensuales (nómina, arriendo, servicios y otros) se reparten
// por unidad vendida, y el precio sugerido cubre: ingredientes + empaque +
// comisión (porcentaje y/o fija) + costos fijos + la utilidad neta objetivo.

export interface BusinessCostsInput {
  nomina: number;
  arriendo: number;
  servicios: number;
  otrosFijos: number;
  unidadesMes: number;
  utilidadObjetivo: number; // fracción (0.15 = 15%)
  comisionPct: number; // fracción (0.15 = 15% del precio bruto)
  comisionFija: number; // valor en COP por venta (mensajero externo)
}

export interface UnitCostsInput {
  ingredientes: number; // products.cost
  empaque: number; // packaging_cost
}

export function totalCostosFijos(input: BusinessCostsInput): number {
  return input.nomina + input.arriendo + input.servicios + input.otrosFijos;
}

export function fixedCostPerUnit(input: BusinessCostsInput): number {
  const fijos = totalCostosFijos(input);
  if (input.unidadesMes <= 0) return fijos;
  return fijos / input.unidadesMes;
}

export function fullCostPrice(
  unit: UnitCostsInput,
  input: BusinessCostsInput
): { precio: number; denom: number } {
  const denom = 1 - input.utilidadObjetivo - input.comisionPct;
  if (denom <= 0.05) return { precio: 0, denom };
  const base =
    unit.ingredientes + unit.empaque + fixedCostPerUnit(input) + input.comisionFija;
  return { precio: Math.ceil(base / denom / 100) * 100, denom };
}

export function breakEvenPrice(
  unit: UnitCostsInput,
  input: BusinessCostsInput
): number {
  const denom = 1 - input.comisionPct;
  if (denom <= 0.05) return 0;
  const base =
    unit.ingredientes + unit.empaque + fixedCostPerUnit(input) + input.comisionFija;
  return Math.ceil(base / denom / 100) * 100;
}

export interface Bucket {
  label: string;
  pesos: number;
  pct: number;
  rangeMin: number;
  rangeMax: number;
}

export interface FullCostBreakdown {
  precio: number;
  denom: number;
  utilidadPesos: number;
  buckets: Bucket[];
}

export function fullCostBreakdown(
  unit: UnitCostsInput,
  input: BusinessCostsInput
): FullCostBreakdown {
  const { precio, denom } = fullCostPrice(unit, input);
  if (precio <= 0) {
    return {
      precio: 0,
      denom,
      utilidadPesos: 0,
      buckets: [],
    };
  }

  const fijoUnit = fixedCostPerUnit(input);
  const comisionPctPesos = precio * input.comisionPct;
  const utilidadPesos =
    precio -
    (unit.ingredientes + unit.empaque + fijoUnit + comisionPctPesos + input.comisionFija);

  const pct = (pesos: number) => (precio > 0 ? (pesos / precio) * 100 : 0);

  const buckets: Bucket[] = [
    { label: "Ingredientes", pesos: unit.ingredientes, pct: pct(unit.ingredientes), rangeMin: 25, rangeMax: 35 },
    { label: "Empaque", pesos: unit.empaque, pct: pct(unit.empaque), rangeMin: 3, rangeMax: 5 },
    {
      label: "Costos fijos (nómina + arriendo + servicios + otros)",
      pesos: fijoUnit,
      pct: pct(fijoUnit),
      rangeMin: 26,
      rangeMax: 41,
    },
    {
      label: "Comisión / domicilios",
      pesos: comisionPctPesos + input.comisionFija,
      pct: pct(comisionPctPesos + input.comisionFija),
      rangeMin: 5,
      rangeMax: 15,
    },
    { label: "Utilidad neta", pesos: Math.max(0, utilidadPesos), pct: pct(utilidadPesos), rangeMin: 10, rangeMax: 20 },
  ];

  return { precio, denom, utilidadPesos, buckets };
}

export function bucketState(pct: number, rangeMin: number, rangeMax: number): "bajo" | "ok" | "alto" {
  if (pct < rangeMin) return "bajo";
  if (pct > rangeMax) return "alto";
  return "ok";
}