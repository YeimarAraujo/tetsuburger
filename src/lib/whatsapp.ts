import { site } from "@/config/site";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { paymentLabel } from "@/lib/payments";
import type { PaymentMethod } from "@/types/db";

/** Enlace de contacto con mensaje prellenado (codificado). */
export function whatsappContactUrl(
  message = "Hola TETSU BURGER, quiero hacer un pedido."
): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}

export { paymentLabel };

export function buildWhatsappMessage(params: {
  orderNumber: number;
  lines: string[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  name: string;
  phone: string;
  address: string;
  notes: string;
  /** Modalidad del pedido; si no se indica se asume domicilio (comportamiento anterior). */
  deliveryType?: "DOMICILIO" | "RECOGIDA" | "LOCAL";
}): string {
  const {
    orderNumber, lines, subtotal, deliveryFee, total, paymentMethod,
    name, phone, address, notes, deliveryType = "DOMICILIO",
  } = params;
  const isDelivery = deliveryType === "DOMICILIO";

  const modalidad = isDelivery
    ? address
      ? `Dirección: ${address}`
      : "Modalidad: Domicilio"
    : deliveryType === "LOCAL"
      ? "Modalidad: Consumo en el local"
      : "Modalidad: Recoge en el local";

  const parts = [
    `*Pedido ${formatOrderNumber(orderNumber)}* — TETSU BURGER`,
    "",
    ...lines,
    // La nota va pegada a los productos y en negrita para que no se pierda
    // al final del mensaje (ej. "sin cebolla").
    ...(notes ? ["", `📝 *NOTA DEL PEDIDO:* ${notes}`] : []),
    "",
    `Subtotal: ${formatCOP(subtotal)}`,
    ...(isDelivery && deliveryFee > 0 ? [`Domicilio: ${formatCOP(deliveryFee)}`] : []),
    ...(isDelivery
      ? [`(El valor del domicilio puede variar dependiendo de la distancia y la hora. En breve te lo confirmamos.)`]
      : []),
    `*Total: ${formatCOP(total)}*`,
    `Medio de pago: ${paymentLabel(paymentMethod)}`,
    "",
    `Nombre: ${name}`,
    modalidad,
    `Teléfono: ${phone}`,
  ];

  return parts.join("\n");
}