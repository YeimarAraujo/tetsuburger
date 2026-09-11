import type { OrderStatus } from "@/types/db";

interface StatusMeta {
  label: string;
  /** Clases Tailwind para el badge */
  badgeClass: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDIENTE: {
    label: "Pendiente",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  CONFIRMADO: {
    label: "Confirmado",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  EN_PREPARACION: {
    label: "En preparación",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
  },
  LISTO: {
    label: "Listo",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  EN_CAMINO: {
    label: "En camino",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  ENTREGADO: {
    label: "Entregado",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  CANCELADO: {
    label: "Cancelado",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
  },
};

/** Flujo normal de estados para avanzar un pedido con un clic */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDIENTE: "CONFIRMADO",
  CONFIRMADO: "EN_PREPARACION",
  EN_PREPARACION: "LISTO",
  LISTO: "EN_CAMINO",
  EN_CAMINO: "ENTREGADO",
};

/**
 * Tipo de entrega que implica transporte físico al cliente.
 * Los pedidos que NO llevan domicilio (RECOGIDA/LOCAL) no deben pasar
 * por la etapa "EN_CAMINO", van directo de LISTO a ENTREGADO.
 */
export function isDeliveryOrder(deliveryType?: string | null): boolean {
  return deliveryType === "DOMICILIO";
}

/** Siguiente estado de un pedido según su tipo de entrega. */
export function nextStatusFor(
  status: OrderStatus,
  deliveryType?: string | null
): OrderStatus | undefined {
  if (status === "LISTO" && !isDeliveryOrder(deliveryType)) {
    return "ENTREGADO";
  }
  return NEXT_STATUS[status];
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDIENTE",
  "CONFIRMADO",
  "EN_PREPARACION",
  "LISTO",
  "EN_CAMINO",
];
