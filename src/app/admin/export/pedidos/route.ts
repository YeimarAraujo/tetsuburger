import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exportación CSV del historial de pedidos. Respeta los filtros from/to del módulo
 * Reportes y solo es accesible para personal autenticado.
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
    .select("order_number, status, customer_name, subtotal, delivery_fee, delivery_fee_retained, payment_method, origin, total, created_at")
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59-05:00`)
    .order("created_at");

  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value")
    .eq("key", "delivery_fee_business");

  const deliveryFeeBusiness = Number(
    (settingsRows ?? []).find((r) => r.key === "delivery_fee_business")?.value ?? 0
  );

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines: string[] = [];
  let total = 0;

  lines.push(["#", "Fecha", "Cliente", "Estado", "Pago", "Subtotal", "Retenido (empresa)", "Total"].join(";"));

  for (const o of orders ?? []) {
    if (o.status === "CANCELADO") continue;
    const sub = Number(o.subtotal);
    const fee = Number(o.delivery_fee);
    const retained = o.delivery_fee_retained === true && fee > 0;
    const t = sub + (retained ? deliveryFeeBusiness : 0);
    total += t;
    const fecha = o.created_at ? o.created_at.slice(0, 10) : "";
    lines.push([
      String(o.order_number),
      fecha,
      esc(o.customer_name ?? ""),
      o.status,
      o.payment_method ?? "EFECTIVO",
      String(sub).replace(".", ","),
      retained ? String(deliveryFeeBusiness).replace(".", ",") : "",
      String(t).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "", "", "", "", "TOTAL", String(total).replace(".", ",")].join(";"));

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
