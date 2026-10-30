/**
 * Reglas del formulario de checkout compartidas por el navegador (errores
 * junto a cada campo) y por placeOrder en el servidor (la barrera real).
 */

export const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
export const NAME_MIN = 2;
export const ADDRESS_MIN = 5;

export const CHECKOUT_MESSAGES = {
  name: "Ingresa tu nombre",
  phone: "Teléfono inválido",
  address: "Ingresa una dirección válida para el domicilio",
} as const;

export interface FieldErrors {
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
}

export function validateCustomer(
  data: { get(name: string): FormDataEntryValue | null },
  deliveryType: "DOMICILIO" | "RECOGIDA"
): FieldErrors {
  const errors: FieldErrors = {};
  const name = String(data.get("customer_name") ?? "").trim();
  const phone = String(data.get("customer_phone") ?? "").trim();
  const address = String(data.get("customer_address") ?? "").trim();

  if (name.length < NAME_MIN) errors.customer_name = CHECKOUT_MESSAGES.name;
  if (!PHONE_RE.test(phone)) {
    errors.customer_phone = phone
      ? `${CHECKOUT_MESSAGES.phone}: usa solo números (7 a 20 dígitos)`
      : "Ingresa tu teléfono o WhatsApp";
  }
  if (deliveryType === "DOMICILIO" && address.length < ADDRESS_MIN) {
    errors.customer_address = CHECKOUT_MESSAGES.address;
  }
  return errors;
}

/** Campo al que pertenece un error devuelto por el servidor, si aplica. */
export function fieldForServerError(message: string): keyof FieldErrors | null {
  if (message === CHECKOUT_MESSAGES.name) return "customer_name";
  if (message === CHECKOUT_MESSAGES.phone) return "customer_phone";
  if (message === CHECKOUT_MESSAGES.address) return "customer_address";
  return null;
}
