import { z } from "zod";
import { cajaBolsilloSchema } from "@/features/caja/schema";

export const socioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre es obligatorio")
    .max(80, "El nombre es muy largo"),
});

export type SocioInput = z.infer<typeof socioSchema>;

/**
 * Préstamo a un socio (sale de una base) o abono del socio (entra a una base).
 */
export const socioMovimientoSchema = z.object({
  socio_id: z.string().uuid("Socio inválido"),
  tipo: z.enum(["PRESTAMO", "ABONO"]),
  movement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  /** Base de la que sale el préstamo / a la que entra el abono. */
  bolsillo: cajaBolsilloSchema,
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA"]).default("EFECTIVO"),
  amount: z.coerce
    .number({ message: "Valor inválido" })
    .min(0.01, "El valor debe ser mayor a 0")
    .max(9_999_999_999),
  description: z.string().trim().max(200).default(""),
});

export type SocioMovimientoInput = z.infer<typeof socioMovimientoSchema>;
