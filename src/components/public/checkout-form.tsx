"use client";

import { useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Banknote,
  CircleAlert,
  CircleCheck,
  Landmark,
  Truck,
  MapPin,
  Info,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import {
  fieldForServerError,
  validateCustomer,
  type FieldErrors,
} from "@/lib/checkout-validation";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { cartSubtotal, itemUnitPrice, useCart } from "@/store/cart";
import { placeOrder } from "@/features/orders/actions";
import { addonLabel } from "@/lib/addons";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrackView } from "@/components/public/track-view";
import {
  isTurnstileEnabled,
  TurnstileWidget,
} from "@/components/public/turnstile-widget";

export function CheckoutForm({ deliveryFee, deliveryFeeAconvenir }: { deliveryFee: number; deliveryFeeAconvenir?: boolean }) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  // El evento se registra una vez con el carrito con el que se llegó.
  const [initialCart] = useState(() => ({
    items: items.length,
    total: cartSubtotal(items),
  }));
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "RECOGIDA">("DOMICILIO");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const turnstileEnabled = isTurnstileEnabled();

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = (["customer_name", "customer_phone", "customer_address"] as const).find((f) => next[f]);
    if (first) document.getElementById(first)?.focus();
  }

  const subtotal = cartSubtotal(items);
  const isDelivery = deliveryType === "DOMICILIO";
  const fee = isDelivery && !deliveryFeeAconvenir ? deliveryFee : 0;
  const total = subtotal + fee;

  if (items.length === 0 && !submitting) {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-lg font-medium">Tu carrito está vacío</h1>
        <Button asChild variant="outline">
          <Link href="/#menu">Volver al menú</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const formData = new FormData(e.currentTarget);

    const honeypot = String(formData.get("website") ?? "");
    if (honeypot) return;

    const fieldErrors = validateCustomer(formData, deliveryType);
    if (Object.keys(fieldErrors).length > 0) {
      showErrors(fieldErrors);
      return;
    }

    if (turnstileEnabled && !turnstileToken) {
      toast.error("Completa la verificación de seguridad antes de continuar.");
      return;
    }

    setSubmitting(true);

    const customer = {
      customer_name: String(formData.get("customer_name") ?? ""),
      customer_phone: String(formData.get("customer_phone") ?? ""),
      customer_address: String(formData.get("customer_address") ?? ""),
      delivery_type: deliveryType,
      notes: String(formData.get("notes") ?? ""),
      payment_method: paymentMethod,
      accepted_terms: true,
      turnstile_token: turnstileToken ?? "",
      website: honeypot,
    };

    const payloadItems = items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      addons: item.addons.map((a) => ({
        addon_id: a.id,
        quantity: a.quantity ?? 1,
        ...(a.target ? { target: a.target } : {}),
        ...(a.target === "EACH" ? { components: a.components ?? 1 } : {}),
      })),
    }));

    const result = await placeOrder(customer, payloadItems);

    if (result.error && !result.orderNumber) {
      setSubmitting(false);
      setTurnstileToken(null);
      setTurnstileResetKey((key) => key + 1);
      // Si el servidor rechaza un campo, el error se muestra junto a ese campo.
      const field = fieldForServerError(result.error);
      if (field) showErrors({ [field]: result.error });
      else toast.error(result.error);
      return;
    }

    if (!result.confirmationToken) {
      setSubmitting(false);
      setTurnstileToken(null);
      setTurnstileResetKey((key) => key + 1);
      toast.error(result.error ?? "No se pudo registrar el pedido");
      return;
    }

    clear();
    track("generate_lead", {
      order_number: result.orderNumber ?? "",
      total: subtotal,
      payment_method: paymentMethod,
    });
    startTransition(() => router.push(`/pedido/confirmado?t=${result.confirmationToken}`));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <TrackView event="begin_checkout" data={initialCart} />

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          href="/resumen"
          aria-label="Volver al resumen del pedido"
          className="rounded-lg border p-2 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Finalizar pedido</h1>
          <p className="text-sm text-muted-foreground">
            Confirma tus datos y elige cómo recibir tu pedido.
          </p>
        </div>
      </div>


      <Card>
        <CardContent className="space-y-7">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          {/* Datos de contacto */}
          <section aria-labelledby="sec-contacto" className="space-y-4">
            <SectionTitle id="sec-contacto" icon={MapPin}>
              Datos de entrega
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="customer_name" label="Nombre" required error={errors.customer_name}>
                <Input
                  id="customer_name"
                  name="customer_name"
                  autoComplete="name"
                  autoCapitalize="words"
                  placeholder="Ej: Ana Pérez"
                  required
                  maxLength={80}
                  aria-invalid={Boolean(errors.customer_name)}
                  aria-describedby={errors.customer_name ? "customer_name-error" : undefined}
                  onChange={() => clearError("customer_name")}
                />
              </Field>
              <Field
                id="customer_phone"
                label="Teléfono / WhatsApp"
                required
                error={errors.customer_phone}
                hint="Te escribimos aquí para confirmar el pedido."
              >
                <Input
                  id="customer_phone"
                  name="customer_phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="300 000 0000"
                  required
                  maxLength={20}
                  aria-invalid={Boolean(errors.customer_phone)}
                  aria-describedby={
                    errors.customer_phone ? "customer_phone-error" : "customer_phone-hint"
                  }
                  onChange={() => clearError("customer_phone")}
                />
              </Field>
            </div>
          </section>

          {/* Forma de entrega */}
          <section aria-labelledby="sec-entrega" className="space-y-4">
            <SectionTitle id="sec-entrega" icon={Truck}>
              ¿Cómo recibes tu pedido?
            </SectionTitle>
            <OptionGroup
              labelledBy="sec-entrega"
              value={deliveryType}
              onChange={(v) => {
                setDeliveryType(v);
                clearError("customer_address");
              }}
              options={[
                {
                  value: "DOMICILIO",
                  label: "Domicilio",
                  hint: deliveryFeeAconvenir
                    ? "Valor a convenir"
                    : deliveryFee > 0
                      ? `+ ${formatCOP(deliveryFee)}`
                      : "Sin costo",
                  Icon: Truck,
                },
                { value: "RECOGIDA", label: "Pasar a recoger", hint: "Sin costo", Icon: MapPin },
              ]}
            />

            <Field
              id="customer_address"
              label={isDelivery ? "Dirección de domicilio" : "Dirección"}
              required={isDelivery}
              optional={!isDelivery}
              error={errors.customer_address}
            >
              <Input
                id="customer_address"
                name="customer_address"
                autoComplete="street-address"
                placeholder={
                  isDelivery
                    ? "Calle 00 #00-00, barrio, apto/torre"
                    : "Solo si quieres dejar una referencia"
                }
                required={isDelivery}
                maxLength={200}
                aria-invalid={Boolean(errors.customer_address)}
                aria-describedby={errors.customer_address ? "customer_address-error" : undefined}
                onChange={() => clearError("customer_address")}
              />
            </Field>

            <Field id="notes" label="Nota para el pedido" optional>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Ej: sin cebolla, punto de cocción, referencias de la casa…"
                rows={3}
                maxLength={300}
              />
            </Field>
          </section>

          {/* Medio de pago */}
          <section aria-labelledby="sec-pago" className="space-y-4">
            <SectionTitle id="sec-pago" icon={Banknote}>
              Medio de pago
            </SectionTitle>
            <OptionGroup
              labelledBy="sec-pago"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={[
                { value: "EFECTIVO", label: "Efectivo", hint: "Pagas al recibir", Icon: Banknote },
                { value: "TRANSFERENCIA", label: "Transferencia", hint: "Te enviamos los datos", Icon: Landmark },
              ]}
            />
          </section>
        </CardContent>
      </Card>

      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-4" />
            Tu pedido
          </CardTitle>
          <CardAction>
            <Link href="/resumen" className="text-sm font-medium text-price hover:underline">
              Editar
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {items.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold">{item.quantity}×</span> {item.name}
                  {item.addons.length > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      + {item.addons.map((a) => addonLabel(a)).join(", ")}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCOP(itemUnitPrice(item) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card> */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCOP(subtotal)}</span>
          </div>
          {deliveryFeeAconvenir ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Domicilio</span>
              <span className="font-medium">Valor a convenir</span>
            </div>
          ) : fee > 0 ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Domicilio</span>
              <span>{formatCOP(fee)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCOP(total)}</span>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm",
              isDelivery && deliveryFeeAconvenir
                ? "border-amber-500/30 bg-amber-500/5 text-orange-900 dark:text-amber-400"
                : "border-transparent bg-muted/40 text-muted-foreground"
            )}
          >
            {isDelivery
              ? deliveryFeeAconvenir
                ? "El valor del domicilio está sujeto a cambios según tu zona, la distancia y la hora. Lo confirmamos contigo por WhatsApp antes de enviar tu pedido. No está incluido en el total."
                : "El domicilio se confirma por WhatsApp según distancia y hora."
              : "Paga al pasar a recoger tu pedido."}
          </div>
        </CardContent>
      </Card>

      {turnstileEnabled ? (
        <TurnstileWidget
          onToken={setTurnstileToken}
          resetKey={turnstileResetKey}
        />
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base"
        disabled={
          submitting ||
          isPending ||
          (turnstileEnabled && !turnstileToken)
        }
      >
        {submitting || isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Registrando pedido…
          </>
        ) : (
          `Enviar y confirmar · ${formatCOP(total)}`
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Tu pedido queda registrado y te llevamos a WhatsApp para confirmar el pago.
      </p>
    </form>
  );
}

/* ----------------------------- Piezas del formulario ----------------------------- */

function SectionTitle({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-base font-semibold">
      <Icon className="size-4 text-price" aria-hidden="true" />
      {children}
    </h2>
  );
}

function Field({
  id,
  label,
  required = false,
  optional = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            {" "}*
          </span>
        ) : null}
        {optional ? <span className="font-normal text-muted-foreground"> (opcional)</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs font-medium text-destructive">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface OptionItem<T extends string> {
  value: T;
  label: string;
  hint: string;
  Icon: LucideIcon;
}

/**
 * Opciones excluyentes como tarjetas: un grupo de radio accesible (Tab entra
 * al elegido, las flechas cambian la selección).
 */
function OptionGroup<T extends string>({
  labelledBy,
  value,
  onChange,
  options,
}: {
  labelledBy: string;
  value: T;
  onChange: (value: T) => void;
  options: OptionItem<T>[];
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 sm:gap-3">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:border-foreground/30 hover:bg-muted"
            )}
          >
            {selected ? (
              <CircleCheck
                className="absolute right-1.5 top-1.5 size-4 fill-primary text-primary-foreground"
                aria-hidden="true"
              />
            ) : null}
            <o.Icon className={cn("size-4", selected ? "text-price" : "text-muted-foreground")} aria-hidden="true" />
            <span className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-foreground/80")}>
              {o.label}
            </span>
            <span className="text-xs text-muted-foreground">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}