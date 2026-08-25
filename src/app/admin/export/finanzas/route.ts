import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Pedidos
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, status, customer_name, subtotal, total, delivery_fee, delivery_fee_retained, payment_method, origin, created_at")
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59-05:00`)
    .order("created_at");

  // Gastos
  const { data: expenses } = await supabase
    .from("expenses")
    .select("expense_date, concept, amount, category:expense_categories(name)")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date");

  // Compras materia prima
  const { data: production } = await supabase
    .from("production_records")
    .select("record_date, total_cost")
    .gte("record_date", from)
    .lte("record_date", to)
    .order("record_date");

  // Settings
  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value")
    .eq("key", "delivery_fee_business");

  const deliveryFeeBusiness = Number(
    (settingsRows ?? []).find((r) => r.key === "delivery_fee_business")?.value ?? 0
  );

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines: string[] = [];
  let totalSubtotal = 0;
  let totalRetainedFees = 0;
  let totalExternalFees = 0;
  let totalExpenses = 0;
  let totalProduction = 0;

  // === VENTAS ===
  lines.push(["=== VENTAS ===", "", "", "", "", "", "", "", ""].join(";"));
  lines.push(["#", "Fecha", "Cliente", "Estado", "Pago", "Subtotal", "Dom", "Retenido", "Total"].join(";"));

  for (const o of orders ?? []) {
    if (o.status === "CANCELADO") continue;
    const sub = Number(o.subtotal);
    const fee = Number(o.delivery_fee);
    const retained = o.delivery_fee_retained === true;
    totalSubtotal += sub;
    if (retained) totalRetainedFees += deliveryFeeBusiness; else totalExternalFees += fee;
    const fecha = o.created_at ? o.created_at.slice(0, 10) : "";
    lines.push([
      String(o.order_number),
      fecha,
      esc(o.customer_name ?? ""),
      o.status,
      o.payment_method ?? "EFECTIVO",
      String(sub).replace(".", ","),
      String(fee).replace(".", ","),
      retained ? "Sí" : "No",
      String(Number(o.total)).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "", "", "SUBTOTAL PRODUCTOS", String(totalSubtotal).replace(".", ","), "", "", ""].join(";"));
  lines.push(["", "", "", "", "DOMICILIOS RETENIDOS", String(totalRetainedFees).replace(".", ","), "", "", ""].join(";"));
  lines.push(["", "", "", "", "DOMICILIOS EXTERNOS", String(totalExternalFees).replace(".", ","), "", "", ""].join(";"));
  lines.push(["", "", "", "", "TOTAL VENTAS", String(totalSubtotal + totalRetainedFees).replace(".", ","), "", "", ""].join(";"));
  lines.push("");

  // === GASTOS ===
  lines.push(["=== GASTOS OPERATIVOS ===", "", "", ""].join(";"));
  lines.push(["Fecha", "Categoría", "Concepto", "Valor"].join(";"));

  for (const e of expenses ?? []) {
    const amount = Number(e.amount);
    totalExpenses += amount;
    const catName = (e.category as unknown as { name?: string } | null)?.name ?? "";
    lines.push([
      e.expense_date,
      esc(catName),
      esc(e.concept),
      String(amount).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "TOTAL GASTOS", String(totalExpenses).replace(".", ",")].join(";"));
  lines.push("");

  // === COMPRAS MATERIA PRIMA ===
  lines.push(["=== COMPRAS MATERIA PRIMA ===", "", ""].join(";"));
  lines.push(["Fecha", "Costo total", ""].join(";"));

  for (const p of production ?? []) {
    const cost = Number(p.total_cost);
    totalProduction += cost;
    lines.push([
      p.record_date,
      String(cost).replace(".", ","),
      "",
    ].join(";"));
  }

  lines.push(["TOTAL COMPRAS", String(totalProduction).replace(".", ",")].join(";"));
  lines.push("");

  // === RESUMEN ===
  const netProfit = (totalSubtotal + totalRetainedFees) - totalExpenses - totalProduction;
  lines.push(["=== RESUMEN FINANCIERO ===", ""].join(";"));
  lines.push(["Ventas (productos + dom retenidos)", String(totalSubtotal + totalRetainedFees).replace(".", ",")].join(";"));
  lines.push(["(-) Gastos operativos", String(totalExpenses).replace(".", ",")].join(";"));
  lines.push(["(-) Compras materia prima", String(totalProduction).replace(".", ",")].join(";"));
  lines.push(["UTILIDAD NETA", String(netProfit).replace(".", ",")].join(";"));

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finanzas_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
