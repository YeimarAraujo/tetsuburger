import type { CajaBolsillo, CajaMetodo } from "@/types/db";

/** Las dos bases de la caja. */
export const BOLSILLOS: CajaBolsillo[] = ["COMPRAS", "GANANCIA"];

export const BOLSILLO_LABEL: Record<CajaBolsillo, string> = {
  COMPRAS: "Base de Compras",
  GANANCIA: "Base de Ganancia",
};

export interface BolsilloMovement {
  movement_date: string;
  bolsillo: CajaBolsillo;
  metodo: CajaMetodo;
  amount: number;
}

export interface BolsilloSaldo {
  efectivo: number;
  transferencia: number;
  total: number;
}

/**
 * Saldo de una base: suma de sus movimientos hasta la fecha indicada
 * (inclusive), separado por medio de pago. Sin fecha, todos los movimientos.
 */
export function saldoBolsillo(
  rows: BolsilloMovement[],
  bolsillo: CajaBolsillo,
  upToDate?: string
): BolsilloSaldo {
  let efectivo = 0;
  let transferencia = 0;
  for (const r of rows) {
    if (r.bolsillo !== bolsillo) continue;
    if (upToDate && r.movement_date > upToDate) continue;
    if (r.metodo === "TRANSFERENCIA") transferencia += Number(r.amount);
    else efectivo += Number(r.amount);
  }
  return { efectivo, transferencia, total: efectivo + transferencia };
}
