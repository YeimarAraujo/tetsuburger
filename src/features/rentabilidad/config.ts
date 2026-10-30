export interface BusinessConfig {
  utilidadPct: number;
  comisionPct: number;
  comisionFija: number;
  nomina: number;
  arriendo: number;
  servicios: number;
  otrosFijos: number;
  /** Ventas mensuales (COP) para repartir los fijos; 0 = usar las ventas reales. */
  ventasMes: number;
  /** Múltiplo al que se redondean los precios sugeridos. */
  redondeo: number;
}

export const ROUNDING_OPTIONS = [100, 500, 1000] as const;

export const DEFAULT_CONFIG: BusinessConfig = {
  utilidadPct: 15,
  comisionPct: 0,
  comisionFija: 0,
  nomina: 0,
  arriendo: 0,
  servicios: 0,
  otrosFijos: 0,
  ventasMes: 0,
  redondeo: 500,
};

export const SETTINGS_KEY = "rentabilidad_business_costs";

export function clampNum(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
}

export function sanitizeConfig(input: Partial<BusinessConfig>): BusinessConfig {
  const redondeo = Number(input.redondeo);
  return {
    utilidadPct: clampNum(input.utilidadPct, 100) || DEFAULT_CONFIG.utilidadPct,
    comisionPct: clampNum(input.comisionPct, 100),
    comisionFija: clampNum(input.comisionFija, 1_000_000_000),
    nomina: clampNum(input.nomina, 1_000_000_000),
    arriendo: clampNum(input.arriendo, 1_000_000_000),
    servicios: clampNum(input.servicios, 1_000_000_000),
    otrosFijos: clampNum(input.otrosFijos, 1_000_000_000),
    ventasMes: clampNum(input.ventasMes, 100_000_000_000),
    redondeo: (ROUNDING_OPTIONS as readonly number[]).includes(redondeo)
      ? redondeo
      : DEFAULT_CONFIG.redondeo,
  };
}
