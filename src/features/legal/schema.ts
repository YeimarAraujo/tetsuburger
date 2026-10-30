import { z } from "zod";

export const PQR_TYPES = [
  { value: "PEDIDO", label: "Pedido o entrega" },
  { value: "PRODUCTO", label: "Producto o calidad" },
  { value: "PRIVACIDAD", label: "Datos personales" },
  { value: "OTRO", label: "Otro" },
] as const;

export const PQR_TYPE_VALUES = PQR_TYPES.map((t) => t.value) as [
  "PEDIDO",
  "PRODUCTO",
  "PRIVACIDAD",
  "OTRO",
];

export const pqrSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80, "Máximo 80 caracteres"),
  email: z
    .string()
    .trim()
    .min(5, "Ingresa tu correo")
    .max(120, "Máximo 120 caracteres")
    .email("Correo no válido"),
  phone: z.string().trim().max(20, "Máximo 20 caracteres").default(""),
  type: z.enum(PQR_TYPE_VALUES, { message: "Selecciona un tipo" }),
  message: z
    .string()
    .trim()
    .min(20, "Cuéntanos con un poco más de detalle (mínimo 20 caracteres)")
    .max(2000, "Máximo 2000 caracteres"),
  consent: z.boolean().refine((value) => value === true, {
    message: "Debes autorizar el tratamiento de tus datos para enviar la solicitud",
  }),
  website: z.string().max(500).default(""),
});

export type PqrInput = z.infer<typeof pqrSchema>;
