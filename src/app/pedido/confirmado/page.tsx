import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getOrderConfirmation } from "@/features/orders/confirmation-actions";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const order = await getOrderConfirmation(t ?? "");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <CheckCircle2 className="size-16 text-emerald-500" />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        ¡Pedido {order.orderNumber ? formatOrderNumber(order.orderNumber) : "recibido"}!
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Tu pedido quedó registrado{order.orderNumber ? ` por ${formatCOP(order.total)}` : ""}.
        Te llevamos a WhatsApp para confirmarlo con el equipo de TETSUBURGER.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {order.whatsappUrl ? (
          <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]">
              Enviar pedido por WhatsApp
            </Button>
          </a>
        ) : null}

        {order.orderNumber && !order.whatsappUrl ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>{order.error ?? "El pedido está registrado."}</strong> Para
            enviarlo por WhatsApp, el administrador debe configurar el número en
            el panel (Configuración).
          </p>
        ) : null}

        {!order.orderNumber ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {order.error ?? "Este enlace no corresponde a un pedido válido."}
          </p>
        ) : null}

        <Link href="/">
          <Button variant="outline" className="w-full">
            Volver al menú
          </Button>
        </Link>
      </div>
    </div>
  );
}