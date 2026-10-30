import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bogotaDate, csvText } from "@/lib/csv";
import { bogotaToday } from "@/lib/bogota";
import { getCogsForOrders, sumCogs } from "@/features/finance/cogs";
import { fetchExpenses } from "@/features/finance/expenses";
import { splitExpenses } from "@/lib/sales-analytics";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const money = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * CSV de Finanzas con la misma fórmula que la pantalla:
 * utilidad = ventas entregadas − costo de lo vendido − gastos operativos.
 * Las compras de materia prima y los empaques se listan como referencia
 * (ya están dentro del costo de lo vendido).
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

  const [{ data: orders }, expenses, { data: production }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, customer_name, subtotal, final_adjustment, payment_method, created_at")
      .eq("status", "ENTREGADO")
      .gte("created_at", `${from}T00:00:00-05:00`)
      .lte("created_at", `${to}T23:59:59-05:00`)
      .order("created_at"),
    fetchExpenses(supabase, from, to),
    supabase
      .from("production_records")
      .select("record_date, description, total_cost, item:inventory_items(name)")
      .gte("record_date", from)
      .lte("record_date", to)
      .order("record_date"),
  ]);

  const delivered = orders ?? [];
  const { map: cogsByOrder } = await getCogsForOrders(delivered.map((o) => o.id));
  const cogsTotal = sumCogs(cogsByOrder);
  const { operating, includedInCost } = splitExpenses(expenses);

  const lines: string[] = [];
  let totalSales = 0;

  lines.push("=== VENTAS ENTREGADAS (productos, sin domicilios) ===");
  lines.push(["#", "Fecha", "Cliente", "Pago", "Subtotal", "Total neto", "Costo de lo vendido"].join(";"));
  for (const o of delivered) {
    const sub = Number(o.subtotal);
    const net = sub - Number(o.final_adjustment ?? 0);
    totalSales += net;
    lines.push([
      String(o.order_number),
      bogotaDate(o.created_at),
      csvText(o.customer_name ?? ""),
      o.payment_method ?? "EFECTIVO",
      money(sub),
      money(net),
      money(cogsByOrder.get(o.id) ?? 0),
    ].join(";"));
  }
  lines.push(["", "", "", "", "TOTAL", money(totalSales), money(cogsTotal)].join(";"));
  lines.push("");

  lines.push("=== GASTOS ===");
  lines.push(["Fecha", "Categoría", "Concepto", "Valor", "Tipo"].join(";"));
  for (const e of expenses) {
    lines.push([
      e.expense_date,
      csvText(e.category?.name ?? ""),
      csvText(e.concept),
      money(e.amount),
      e.includedInProductCost ? "Incluido en el costo de lo vendido" : "Operativo",
    ].join(";"));
  }
  lines.push(["", "", "TOTAL GASTOS OPERATIVOS", money(operating), ""].join(";"));
  if (includedInCost > 0) {
    lines.push(["", "", "Empaques (ya en el costo de lo vendido)", money(includedInCost), ""].join(";"));
  }
  lines.push("");

  let totalProduction = 0;
  lines.push("=== COMPRAS DE MATERIA PRIMA (referencia) ===");
  lines.push(["Fecha", "Insumo", "Descripción", "Costo total"].join(";"));
  for (const p of production ?? []) {
    const cost = Number(p.total_cost);
    totalProduction += cost;
    const item = (p.item as unknown as { name?: string } | null)?.name ?? "";
    lines.push([p.record_date, csvText(item), csvText(p.description ?? ""), money(cost)].join(";"));
  }
  lines.push(["", "", "TOTAL COMPRAS", money(totalProduction)].join(";"));
  lines.push("");

  const netProfit = totalSales - cogsTotal - operating;
  lines.push("=== RESUMEN ===");
  lines.push(["Ventas entregadas (sin domicilios)", money(totalSales)].join(";"));
  lines.push(["(-) Costo de lo vendido", money(cogsTotal)].join(";"));
  lines.push(["(-) Gastos operativos", money(operating)].join(";"));
  lines.push(["UTILIDAD NETA", money(netProfit)].join(";"));
  lines.push(["Las compras de materia prima y los empaques ya están dentro del costo de lo vendido.", ""].join(";"));

  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finanzas_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
