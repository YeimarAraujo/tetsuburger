"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Banknote, Landmark, Truck, MapPin, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { cartSubtotal, useCart } from "@/store/cart";
import { placeOrder } from "@/features/orders/actions";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "RECOGIDA">("DOMICILIO");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileEnabled = isTurnstileEnabled();

  const subtotal = cartSubtotal(items);
  const isDelivery = deliveryType === "DOMICILIO";
  const fee = isDelivery && !deliveryFeeAconvenir ? deliveryFee : 0;
  const total = subtotal + fee;

  if (items.length === 0 && !submitting) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-lg font-medium">Tu carrito está vacío</p>
        <Link href="/">
          <Button variant="outline">Volver al menú</Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const formData = new FormData(e.currentTarget);

    const honeypot = String(formData.get("website") ?? "");
    if (honeypot) return;

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
      toast.error(result.error);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <TrackView
        event="begin_checkout"
        data={{ items: items.length, total: subtotal }}
      />

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link href="/resumen" className="rounded-lg border p-2 transition-colors hover:bg-muted">
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
        <CardContent className="space-y-6 p-0">
          {/* Datos de entrega */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4" />
              Datos de entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nombre *</Label>
                <Input
                  id="customer_name"
                  name="customer_name"
                  placeholder="Tu nombre"
                  required
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Teléfono / WhatsApp *</Label>
                <Input
                  id="customer_phone"
                  name="customer_phone"
                  type="tel"
                  placeholder="300 000 0000"
                  required
                  maxLength={20}
                />
              </div>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-4" />
                ¿Cómo recibes tu pedido?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={deliveryType === "DOMICILIO"}
                  onClick={() => setDeliveryType("DOMICILIO")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border border-dashed px-2.5 py-2 text-xs font-medium transition-colors",
                    deliveryType === "DOMICILIO"
                      ? "border-primary bg-primary/5 text-primary"
                      : "text-muted-foreground hover:border-foreground/30 hover:bg-muted"
                  )}
                >
                  <Truck className="size-3.5" />
                  <span className="text-xs">Domicilio</span>
                  {deliveryFeeAconvenir ? (
                    <span className="text-[9px] font-medium text-muted-foreground">
                      a convenir
                    </span>
                  ) : fee > 0 ? (
                    <span className="text-[9px] font-medium text-primary">
                      + {formatCOP(fee)}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={deliveryType === "RECOGIDA"}
                  onClick={() => setDeliveryType("RECOGIDA")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border border-dashed px-2.5 py-2 text-xs font-medium transition-colors",
                    deliveryType === "RECOGIDA"
                      ? "border-primary bg-primary/5 text-primary"
                      : "text-muted-foreground hover:border-foreground/30 hover:bg-muted"
                  )}
                >
                  <MapPin className="size-3.5" />
                  <span className="text-xs">Pasar a recoger</span>
                  <span className="text-[9px] font-medium text-muted-foreground">
                    Sin costo
                  </span>
                </button>
              </div>
            </CardContent>

            <div className="space-y-2">
              <Label
                htmlFor="customer_address"
                className={cn(
                  "flex items-center gap-1",
                  isDelivery && "after:[content:'*'] after:text-destructive"
                )}
              >
                {isDelivery ? "Dirección de domicilio" : "Dirección (opcional)"}
              </Label>
              <Input
                id="customer_address"
                name="customer_address"
                placeholder={
                  isDelivery
                    ? "Calle 00 #00-00, Barrio, Apto/Torre"
                    : "Solo si quieres dejar una referencia"
                }
                required={isDelivery}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Nota para el pedido</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Ej: sin cebolla, punto de cocción, referencias de la casa…"
                rows={3}
                maxLength={300}
              />
            </div>
          </CardContent>

          {/* Tipo de entrega */}

        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="size-4" />
            Medio de pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([
              {
                value: "EFECTIVO",
                label: "Efectivo",
                hint: "Pagas al recibir",
                Icon: Banknote,
              },
              {
                value: "TRANSFERENCIA",
                label: "Transferencia",
                hint: "Te enviamos los datos",
                Icon: Landmark,
              },
            ] as const).map(({ value, label, hint, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={paymentMethod === value}
                onClick={() => setPaymentMethod(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border border-dashed px-2.5 py-2 text-xs font-medium transition-colors",
                  paymentMethod === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "text-muted-foreground hover:border-foreground/30 hover:bg-muted"
                )}
              >
                <Icon className="size-3.5" />
                <span className="text-xs">{label}</span>
                <span className="text-[9px] font-medium text-muted-foreground">
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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
        size="sm"
        className="w-full"
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