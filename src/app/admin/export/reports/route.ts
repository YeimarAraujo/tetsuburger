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
  const cat = params.get("cat");

  // Pedidos
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, status, customer_name, total, delivery_fee, payment_method, origin, created_at")
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59-05:00`)
    .order("created_at");

  // Gastos
  let expQuery = supabase
    .from("expenses")
    .select("expense_date, concept, amount, category:expense_categories(name)")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date");

  if (cat && cat !== "todas") {
    expQuery = expQuery.eq("expense_category_id", Number(cat));
  }

  const { data: expenses } = await expQuery;

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines: string[] = [];
  let totalVentas = 0;
  let totalGastos = 0;

  // Sección de pedidos
  lines.push(["=== VENTAS ===", "", "", "", "", "", ""].join(";"));
  lines.push(["#", "Fecha", "Cliente", "Estado", "Pago", "Total", "Domicilio"].join(";"));

  for (const o of orders ?? []) {
    if (o.status === "CANCELADO") continue;
    const total = Number(o.total);
    totalVentas += total;
    const fecha = o.created_at ? o.created_at.slice(0, 10) : "";
    lines.push([
      String(o.order_number),
      fecha,
      esc(o.customer_name ?? ""),
      o.status,
      o.payment_method ?? "EFECTIVO",
      String(total).replace(".", ","),
      String(Number(o.delivery_fee)).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "", "", "TOTAL VENTAS", String(totalVentas).replace(".", ","), ""].join(";"));
  lines.push("");

  // Sección de gastos
  lines.push(["=== GASTOS ===", "", "", ""].join(";"));
  lines.push(["Fecha", "Categoría", "Concepto", "Valor"].join(";"));

  for (const e of expenses ?? []) {
    const amount = Number(e.amount);
    totalGastos += amount;
    const catName = (e.category as unknown as { name?: string } | null)?.name ?? "";
    lines.push([
      e.expense_date,
      esc(catName),
      esc(e.concept),
      String(amount).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "TOTAL GASTOS", String(totalGastos).replace(".", ",")].join(";"));
  lines.push("");

  // Resumen
  lines.push(["=== RESUMEN ===", "", "", ""].join(";"));
  lines.push(["Ventas netas", String(totalVentas).replace(".", ",")].join(";"));
  lines.push(["Gastos", String(totalGastos).replace(".", ",")].join(";"));
  lines.push(["Utilidad estimada", String(totalVentas - totalGastos).replace(".", ",")].join(";"));

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
