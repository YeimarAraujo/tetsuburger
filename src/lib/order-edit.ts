/**
 * Cálculos para editar un pedido ya registrado (quitar productos). Lógica pura:
 * la usan el servidor (decide y guarda) y el tablero (muestra el efecto antes
 * de confirmar), así ambos coinciden.
 */

export interface EditableLine {
  id: string;
  quantity: number;
  unit_price: number;
  /** Regalo de promoción (precio 0). */
  is_gift?: boolean;
  order_item_addons: {
    addon_price: number;
    quantity: number | null;
    target: string | null;
    components_qty: number | null;
  }[];
}

/** Valor de UNA unidad de la línea: producto + sus adicionales (como al crearla). */
export function lineUnitValue(line: EditableLine): number {
  const addons = (line.order_item_addons ?? []).reduce(
    (sum, a) =>
      sum +
      Number(a.addon_price) *
        (a.quantity ?? 1) *
        (a.target === "EACH" ? (a.components_qty ?? 1) : 1),
    0
  );
  return Number(line.unit_price) + addons;
}

/**
 * Cuántas unidades de una línea se pueden quitar. Un pedido no puede quedar sin
 * nada que cobrar: si es la única línea de pago, siempre debe quedar al menos
 * una unidad. Los regalos se pueden quitar siempre. 0 si la línea no existe.
 */
export function maxRemovableUnits(lines: EditableLine[], lineId: string): number {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return 0;
  const paidLines = lines.filter((l) => !l.is_gift).length;
  const isOnlyPaidLine = !line.is_gift && paidLines === 1;
  return isOnlyPaidLine ? line.quantity - 1 : line.quantity;
}

export type RemovalPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Unidades que se quitan. */
      removeQty: number;
      /** Se borra la línea completa (si no, solo se resta cantidad). */
      removesWholeLine: boolean;
      /** Valor que se descuenta del subtotal. */
      amount: number;
      newSubtotal: number;
      newTotal: number;
    };

/**
 * Calcula cómo queda un pedido al quitar un producto (o parte de sus unidades).
 * El ajuste del valor final se conserva: si el nuevo total quedaría por debajo
 * de ese ajuste, se rechaza (hay que editar el valor final primero).
 */
export function planItemRemoval(params: {
  subtotal: number;
  deliveryFee: number;
  finalAdjustment: number;
  lines: EditableLine[];
  lineId: string;
  /** Unidades a quitar; si se omite, toda la línea. */
  quantity?: number;
}): RemovalPlan {
  const { lines, lineId } = params;
  const line = lines.find((l) => l.id === lineId);
  if (!line) return { ok: false, error: "Ese producto ya no está en el pedido" };

  const removeQty = Math.min(params.quantity ?? line.quantity, line.quantity);
  if (removeQty < 1) return { ok: false, error: "Indica cuántas unidades quitar" };

  if (removeQty > maxRemovableUnits(lines, lineId)) {
    return {
      ok: false,
      error: "El pedido no puede quedar sin productos. Si ya no se necesita, cancélalo.",
    };
  }

  const removesWholeLine = removeQty >= line.quantity;
  const amount = lineUnitValue(line) * removeQty;
  const newSubtotal = Math.max(0, Number(params.subtotal) - amount);
  const adjustment = Number(params.finalAdjustment ?? 0);
  const fee = Number(params.deliveryFee);

  if (adjustment > newSubtotal + fee) {
    return {
      ok: false,
      error:
        "El valor final acordado quedaría por encima del nuevo total. Edita el valor final del pedido y vuelve a intentarlo.",
    };
  }

  return {
    ok: true,
    removeQty,
    removesWholeLine,
    amount,
    newSubtotal,
    newTotal: newSubtotal + fee - adjustment,
  };
}
