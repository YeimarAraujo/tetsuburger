import { site } from "@/config/site";
import { formatCOP, formatOrderNumber } from "@/lib/format";

/** Enlace de contacto con mensaje prellenado (codificado). */
export function whatsappContactUrl(
  message = "Hola TETSU BURGER, quiero hacer un pedido."
): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function paymentLabel(method: "EFECTIVO" | "TRANSFERENCIA"): string {
  return method === "EFECTIVO" ? "Efectivo" : "Transferencia";
}

export function buildWhatsappMessage(params: {
  orderNumber: number;
  lines: string[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA";
  name: string;
  phone: string;
  address: string;
  notes: string;
}): string {
  const {
    orderNumber, lines, subtotal, deliveryFee, total, paymentMethod,
    name, phone, address, notes,
  } = params;

  const parts = [
    `*Pedido ${formatOrderNumber(orderNumber)}* — TETSU BURGER`,
    "",
    ...lines,
    "",
    `Subtotal: ${formatCOP(subtotal)}`,
    ...(deliveryFee > 0 ? [`Domicilio: ${formatCOP(deliveryFee)}`] : []),
    `(El valor del domicilio puede variar dependiendo de la distancia y la hora. En breve te lo confirmamos.)`,
    `*Total: ${formatCOP(total)}*`,
    `Medio de pago: ${paymentLabel(paymentMethod)}`,
    "",
    `Nombre: ${name}`,
    ...(address ? [`Dirección: ${address}`] : ["Modalidad: Domicilio"]),
    `Teléfono: ${phone}`,
    ...(notes ? ["", `Nota: ${notes}`] : []),
  ];

  return parts.join("\n");
}