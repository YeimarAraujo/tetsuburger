import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Gift, Truck } from "lucide-react";
import { getOrderConfirmation } from "@/features/orders/confirmation-actions";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PostOrderReviews } from "@/components/public/post-order-reviews";
import { SiteFooter } from "@/components/public/site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const order = await getOrderConfirmation(t ?? "");
  const valid = Boolean(order.orderNumber);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-center">
      {valid ? (
        <CheckCircle2 className="size-16 text-emerald-600" />
      ) : (
        <AlertTriangle className="size-16 text-amber-500" />
      )}

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        {valid
          ? `¡Pedido ${formatOrderNumber(order.orderNumber)}!`
          : "Pedido no encontrado"}
      </h1>

      {valid ? (
        <p className="mt-2 max-w-sm text-muted-foreground">
          Tu pedido quedó registrado por un total de {formatCOP(order.total)}.
          Confírmalo con el equipo de TETSU BURGER por WhatsApp.
        </p>
      ) : (
        <p className="mt-2 max-w-sm text-muted-foreground">
          {order.error ?? "Este enlace no corresponde a un pedido válido."}
        </p>
      )}

      {valid && (order.gifts?.length || order.freeDelivery) ? (
        <div
          role="status"
          className="mt-6 w-full max-w-sm space-y-2 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left"
        >
          {order.gifts?.length ? (
            <div className="flex items-start gap-3">
              <Gift className="mt-0.5 size-6 shrink-0 text-price" aria-hidden="true" />
              <div>
                <p className="font-bold">¡Te ganaste un regalo!</p>
                <p className="text-sm text-muted-foreground">
                  {order.gifts.join(", ")} de cortesía. Te lo entregamos junto con tu pedido.
                </p>
              </div>
            </div>
          ) : null}
          {order.freeDelivery ? (
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 size-6 shrink-0 text-price" aria-hidden="true" />
              <div>
                <p className="font-bold">¡Domicilio gratis!</p>
                <p className="text-sm text-muted-foreground">
                  Por tu compra, el domicilio va por nuestra cuenta.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {order.whatsappUrl ? (
          <Button
            asChild
            size="lg"
            className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]"
          >
            <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
              Enviar pedido por WhatsApp
            </a>
          </Button>
        ) : null}

        {valid && !order.whatsappUrl ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>{order.error ?? "El pedido está registrado."}</strong> Para
            enviarlo por WhatsApp, el administrador debe configurar el número en
            el panel (Configuración).
          </p>
        ) : null}

        <Button asChild variant="outline" className="w-full">
          <Link href="/">Volver al menú</Link>
        </Button>
      </div>

      {valid && order.items && order.items.length > 0 && t ? (
        <div className="mt-10 w-full max-w-md">
          <PostOrderReviews
            token={t}
            customerName={order.customerName ?? ""}
            items={order.items}
          />
        </div>
      ) : null}

      <div className="mt-12 w-full">
        <SiteFooter />
      </div>
    </div>
  );
}
