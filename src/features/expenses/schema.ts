import { z } from "zod";

export const expenseSchema = z.object({
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  expense_category_id: z.coerce.number().int("Categoría inválida").positive("Selecciona una categoría"),
  concept: z.string().trim().min(2, "El concepto debe tener al menos 2 caracteres").max(120, "Máximo 120 caracteres"),
  amount: z.coerce.number({ message: "Valor inválido" }).min(0, "El valor no puede ser negativo").max(9_999_999_999),
  description: z.string().trim().max(500).default(""),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
