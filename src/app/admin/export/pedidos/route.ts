import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bogotaDate, csvText } from "@/lib/csv";
import { bogotaToday } from "@/lib/bogota";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 1000;
const money = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

interface OrderRow {
  order_number: number;
  customer_name: string | null;
  subtotal: number | string;
  final_adjustment: number | string | null;
  payment_method: string | null;
  origin: string;
  created_at: string;
  items?: {
    quantity: number;
    product?: { conteo_hamburguesas: number; conteo_perros: number } | null;
  }[];
}

/**
 * CSV del historial de pedidos ENTREGADO del período (mismo criterio que
 * Reportes), con el conteo de hamburguesas/perros por pedido. Se lee por
 * páginas para no perder pedidos en períodos largos.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse("No autorizado", { status: 401 });

  const params = request.nextUrl.searchParams;
  const today = bogotaToday();
  const rawFrom = params.get("from") ?? "";
  const rawTo = params.get("to") ?? "";
  const from = DATE_RE.test(rawFrom) ? rawFrom : `${today.slice(0, 8)}01`;
  const to = DATE_RE.test(rawTo) ? rawTo : today;

  const orders: OrderRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_number, customer_name, subtotal, final_adjustment, payment_method, origin, created_at, items:order_items(quantity, product:products(conteo_hamburguesas, conteo_perros))"
      )
      .eq("status", "ENTREGADO")
      .gte("created_at", `${from}T00:00:00-05:00`)
      .lte("created_at", `${to}T23:59:59-05:00`)
      .order("created_at")
      .range(offset, offset + PAGE - 1);

    if (error) return new NextResponse("No se pudo generar la exportación", { status: 500 });
    orders.push(...((data ?? []) as unknown as OrderRow[]));
    if (!data || data.length < PAGE) break;
  }

  const lines: string[] = [
    ["#", "Fecha", "Cliente", "Pago", "Origen", "Hamburguesas", "Perros", "Subtotal", "Total (sin domicilio)"].join(";"),
  ];
  let total = 0;
  let totalH = 0;
  let totalP = 0;

  for (const o of orders) {
    const sub = Number(o.subtotal);
    const net = sub - Number(o.final_adjustment ?? 0);
    let h = 0;
    let p = 0;
    for (const i of o.items ?? []) {
      const product = i.product && !Array.isArray(i.product) ? i.product : null;
      h += (Number(product?.conteo_hamburguesas) || 0) * Number(i.quantity);
      p += (Number(product?.conteo_perros) || 0) * Number(i.quantity);
    }
    total += net;
    totalH += h;
    totalP += p;
    lines.push([
      String(o.order_number),
      bogotaDate(o.created_at),
      csvText(o.customer_name ?? ""),
      o.payment_method ?? "EFECTIVO",
      o.origin,
      String(h),
      String(p),
      money(sub),
      money(net),
    ].join(";"));
  }

  lines.push(["", "", "", "", "TOTAL", String(totalH), String(totalP), "", money(total)].join(";"));

  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
