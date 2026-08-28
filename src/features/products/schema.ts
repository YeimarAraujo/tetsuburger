import { z } from "zod";

export const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  category_id: z.string().uuid("Selecciona una categoría válida"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").default(""),
  price: z.coerce.number({ message: "Precio inválido" }).min(0, "El precio no puede ser negativo").max(99_999_999),
  cost: z.coerce.number({ message: "Costo inválido" }).min(0, "El costo no puede ser negativo").max(99_999_999).default(0),
  is_active: z.boolean().default(true),
  is_available: z.boolean().default(true),
  is_featured: z.boolean().default(false),
});

export type ProductInput = z.infer<typeof productSchema>;

export const addonSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
  price: z.coerce.number({ message: "Precio inválido" }).min(0, "El precio no puede ser negativo").max(9_999_999),
  is_active: z.boolean().default(true),
});

export type AddonInput = z.infer<typeof addonSchema>;
