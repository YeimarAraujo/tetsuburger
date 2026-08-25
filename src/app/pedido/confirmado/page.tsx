"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatCOP, formatOrderNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

interface LastOrder {
  orderNumber: number;
  total: number;
  whatsappUrl: string;
}

export default function OrderConfirmedPage() {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("tetsuburger-last-order");
    if (raw) {
      try {
        setOrder(JSON.parse(raw) as LastOrder);
      } catch {
        setOrder(null);
      }
    }

    // Abre WhatsApp automáticamente una sola vez
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LastOrder;
        if (parsed.whatsappUrl) {
          const timer = setTimeout(() => window.open(parsed.whatsappUrl, "_blank"), 900);
          return () => clearTimeout(timer);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <CheckCircle2 className="size-16 text-emerald-500" />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        ¡Pedido {order ? formatOrderNumber(order.orderNumber) : "recibido"}!
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Tu pedido quedó registrado{order ? ` por ${formatCOP(order.total)}` : ""}.
        Te llevamos a WhatsApp para confirmarlo con el equipo de TETSUBURGER.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {order?.whatsappUrl ? (
          <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]">
              Enviar pedido por WhatsApp
            </Button>
          </a>
        ) : null}

        {order && !order.whatsappUrl ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            El pedido está registrado. El administrador debe configurar el
            número de WhatsApp en el panel (Configuración).
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
