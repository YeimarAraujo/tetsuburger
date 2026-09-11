import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  countSales,
  productCountMap,
  type SaleLine,
} from "@/lib/sales-counting";

/**
 * Exportación CSV del historial de pedidos. Respeta los filtros from/to del módulo
 * Reportes, incluye el conteo de hamburguesas/perros por pedido y solo es
 * accesible para personal autenticado.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse("No autorizado", { status: 401 });

  const params = request.nextUrl.searchParams;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const from = params.get("from") || `${today.slice(0, 8)}01`;
  const to = params.get("to") || today;

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, customer_name, subtotal, payment_method, origin, created_at")
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59-05:00`)
    .order("created_at");

  const active = (orders ?? []).filter((o) => o.status !== "CANCELADO");
  const activeIds = active.map((o) => o.id);

  let perOrder: ReturnType<typeof countSales>["perOrder"] = {};
  if (activeIds.length > 0) {
    const [itemsRes, productsRes] = await Promise.all([
      supabase
        .from("order_items")
        .select("order_id, product_id, product_name, quantity, line_total")
        .in("order_id", activeIds),
      supabase
        .from("products")
        .select("id, conteo_hamburguesas, conteo_perros"),
    ]);

    const saleLines: SaleLine[] = ((itemsRes.data ?? []) as unknown as {
      order_id: string;
      product_id: string | null;
      product_name: string;
      quantity: number;
      line_total: number | string;
    }[]).map((i) => ({
      orderId: i.order_id,
      productId: i.product_id,
      productName: i.product_name,
      quantity: Number(i.quantity),
      lineTotal: Number(i.line_total),
    }));

    const productCounts = productCountMap(
      ((productsRes.data ?? []) as unknown as {
        id: string;
        conteo_hamburguesas: number;
        conteo_perros: number;
      }[])
    );

    perOrder = countSales(saleLines, productCounts).perOrder;
  }

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines: string[] = [];
  let total = 0;
  let totalH = 0;
  let totalP = 0;

  lines.push(["#", "Fecha", "Cliente", "Estado", "Pago", "Hamburguesas", "Perros", "Subtotal", "Total (sin doms)"].join(";"));

  for (const o of active) {
    const sub = Number(o.subtotal);
    total += sub;
    const c = perOrder[o.id] ?? { hamburguesas: 0, perros: 0 };
    totalH += c.hamburguesas;
    totalP += c.perros;
    const fecha = o.created_at ? o.created_at.slice(0, 10) : "";
    lines.push([
      String(o.order_number),
      fecha,
      esc(o.customer_name ?? ""),
      o.status,
      o.payment_method ?? "EFECTIVO",
      String(c.hamburguesas),
      String(c.perros),
      String(sub).replace(".", ","),
      String(sub).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "", "", "", String(totalH), String(totalP), "TOTAL", String(total).replace(".", ",")].join(";"));

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}