"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Banknote, Landmark } from "lucide-react";
import { toast } from "sonner";
import { cartSubtotal, itemUnitPrice, useCart } from "@/store/cart";
import { placeOrder } from "@/features/orders/actions";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const subtotal = cartSubtotal(items);
  const total = subtotal + deliveryFee;

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
      notes: String(formData.get("notes") ?? ""),
      payment_method: paymentMethod,
    };

    const payloadItems = items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      addon_ids: item.addons.map((a) => a.id),
    }));

    // Honeypot anti-spam: si el campo oculto viene lleno, es un bot
    const honeypot = String(formData.get("website") ?? "");
    if (honeypot) {
      return;
    }

    const result = await placeOrder(customer, payloadItems);

    if (result.error || !result.orderNumber) {
      setSubmitting(false);
      toast.error(result.error ?? "No se pudo registrar el pedido");
      if (!result.orderNumber) return;
    }

    // Pedido registrado: guarda resumen para la pantalla de confirmación
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
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
            <Label htmlFor="customer_address">Dirección de domicilio *</Label>
            <Input
              id="customer_address"
              name="customer_address"
              placeholder="Calle 00 #00-00, Barrio, Apto/Torre"
              required
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
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {items.map((item) => (
              <div key={item.key} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{item.quantity}×</span>{" "}
                  {item.name}
                  {item.addons.length > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      + {item.addons.map((a) => a.name).join(", ")}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-medium">
                  {formatCOP(itemUnitPrice(item) * item.quantity)}
                </span>
              </div>
            ))}

            <Separator />

            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Domicilio</span>
              <span>{deliveryFee > 0 ? formatCOP(deliveryFee) : "Gratis"}</span>
            </div>

            <Separator />

            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCOP(total)}</span>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting || isPending}>
              {submitting || isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registrando pedido…
                </>
              ) : (
                `Confirmar y pagar por WhatsApp · ${formatCOP(total)}`
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Tu pedido queda registrado y te llevamos a WhatsApp para confirmar
              el pago.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
