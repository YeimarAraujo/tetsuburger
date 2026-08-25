import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
  description: z.string().trim().max(200, "Máximo 200 caracteres").default(""),
  image_url: z.string().trim().max(500).default(""),
  display_order: z.coerce.number().int("Debe ser un entero").min(0, "No puede ser negativo").default(0),
  is_active: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;
