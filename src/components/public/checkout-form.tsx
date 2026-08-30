"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Banknote, Landmark, Truck, Store, Info } from "lucide-react";
import { toast } from "sonner";
import { cartSubtotal, cartCount, useCart } from "@/store/cart";
import { placeOrder } from "@/features/orders/actions";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export function CheckoutForm({ deliveryFee }: { deliveryFee: number }) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "RECOGIDA">("DOMICILIO");

  const subtotal = cartSubtotal(items);
  const fee = deliveryType === "DOMICILIO" ? deliveryFee : 0;
  const total = subtotal + fee;
  const count = cartCount(items);

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
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const customer = {
      customer_name: String(formData.get("customer_name") ?? ""),
      customer_phone: String(formData.get("customer_phone") ?? ""),
      customer_address: String(formData.get("customer_address") ?? ""),
      delivery_type: deliveryType,
      notes: String(formData.get("notes") ?? ""),
      payment_method: paymentMethod,
    };

    const payloadItems = items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      addon_ids: item.addons.map((a) => a.id),
    }));

    // Honeypot anti-spam
    const honeypot = String(formData.get("website") ?? "");
    if (honeypot) return;

    const result = await placeOrder(customer, payloadItems);

    if (result.error || !result.orderNumber) {
      setSubmitting(false);
      toast.error(result.error ?? "No se pudo registrar el pedido");
      if (!result.orderNumber) return;
    }

    sessionStorage.setItem(
      "tetsuburger-last-order",
      JSON.stringify({
        orderNumber: result.orderNumber,
        total: result.total ?? total,
        whatsappUrl: result.whatsappUrl ?? "",
      })
    );

    clear();
    startTransition(() => router.push("/pedido/confirmado"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Datos de entrega */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de entrega</CardTitle>
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
              <Input id="customer_name" name="customer_name" placeholder="Tu nombre" required maxLength={80} />
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

          <div className="space-y-2">
            <Label htmlFor="customer_address">
              {deliveryType === "DOMICILIO" ? "Dirección de domicilio *" : "Dirección (opcional, para referencia)"}
            </Label>
            <Input
              id="customer_address"
              name="customer_address"
              placeholder={deliveryType === "DOMICILIO" ? "Calle 00 #00-00, Barrio, Apto/Torre" : "Referencia (opcional)"}
              required={deliveryType === "DOMICILIO"}
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


          <div className="space-y-2">
            <Label>Medio de pago *</Label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "EFECTIVO", label: "Efectivo", hint: "Al recibir tu pedido", Icon: Banknote },
                { value: "TRANSFERENCIA", label: "Transferencia", hint: "Te enviamos los datos", Icon: Landmark },
              ] as const).map(({ value, label, hint, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    paymentMethod === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                  <span className="text-[11px] font-normal">{hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>¿Cómo deseas recibir tu pedido? *</Label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "DOMICILIO", label: "Domicilio", hint: "Te lo llevamos", Icon: Truck },
                { value: "RECOGIDA", label: "Pasar a recoger", hint: "Lo retiras en el local", Icon: Store },
              ] as const).map(({ value, label, hint, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryType(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    deliveryType === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                  <span className="text-[11px] font-normal">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {deliveryType === "DOMICILIO" ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                El valor del domicilio puede variar dependiendo de la distancia y la hora.
                El valor que aparece es una referencia; te lo confirmamos en WhatsApp.
              </p>
            </div>
          ) : null}

          <Separator />

          <Button type="submit" size="lg" className="w-full" disabled={submitting || isPending}>
            {submitting || isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Registrando pedido…
              </>
            ) : (
              `Enviar por whatsapp · ${formatCOP(total)}`
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Tu pedido queda registrado y te llevamos a WhatsApp para confirmar el pago.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
