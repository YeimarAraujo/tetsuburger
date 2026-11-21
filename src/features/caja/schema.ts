import { z } from "zod";

export const cajaBolsilloSchema = z.enum(["COMPRAS", "GANANCIA"]);

/**
 * Movimiento manual de caja: ingreso adicional, retiro del dueño o ajuste
 * (sobrante/faltante) del arqueo. La venta en efectivo y los descuentos de
 * compras/gastos se generan automáticamente.
 */
export const cajaManualMovementSchema = z.object({
  movement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  tipo: z.enum(["INGRESO_EXTRA", "RETIRO", "AJUSTE"]),
  /** Base a la que entra o de la que sale el movimiento. */
  bolsillo: cajaBolsilloSchema.default("GANANCIA"),
  /** Canal por el que entra/sale el dinero (el ajuste del arqueo es efectivo). */
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA"]).default("EFECTIVO"),
  es_ingreso: z
    .string()
    .transform((v) => v === "true")
    .default(false),
  amount: z.coerce
    .number({ message: "Valor inválido" })
    .min(0.01, "El valor debe ser mayor a 0")
    .max(9_999_999_999),
  description: z
    .string()
    .trim()
    .min(2, "La descripción es obligatoria")
    .max(200),
});

export type CajaManualMovementInput = z.infer<typeof cajaManualMovementSchema>;

/** Traslado de plata de una base a la otra (mismo medio de pago). */
export const cajaTransferSchema = z.object({
  movement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  /** Base de la que sale; entra a la otra. */
  desde: cajaBolsilloSchema,
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA"]).default("EFECTIVO"),
  amount: z.coerce
    .number({ message: "Valor inválido" })
    .min(0.01, "El valor debe ser mayor a 0")
    .max(9_999_999_999),
  description: z.string().trim().max(200).default(""),
});

export type CajaTransferInput = z.infer<typeof cajaTransferSchema>;
