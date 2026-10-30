import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { csvText } from "@/lib/csv";
import { bogotaToday } from "@/lib/bogota";
import { parseSalesReport } from "@/lib/sales-analytics";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const money = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * CSV del ranking "Más vendidos" de Reportes: pedidos ENTREGADO del período,
 * ingresos con adicionales y ganancia con el costo guardado en cada venta.
 * Tipo: todos | hamburguesas | perros.
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
  const tipo = params.get("tipo") === "hamburguesas" || params.get("tipo") === "perros" ? params.get("tipo") : "todos";

  const { data, error } = await supabase.rpc("sales_report", { p_from: from, p_to: to });
  if (error) {
    const message =
      error.code === "PGRST202"
        ? "Aplica la migración 0033 en Supabase para exportar este reporte."
        : "No se pudo generar la exportación";
    return new NextResponse(message, { status: 500 });
  }

  const products = parseSalesReport(data).products;
  const ranking =
    tipo === "hamburguesas"
      ? products.filter((p) => p.hamburguesas > 0).sort((a, b) => b.hamburguesas - a.hamburguesas)
      : tipo === "perros"
        ? products.filter((p) => p.perros > 0).sort((a, b) => b.perros - a.perros)
        : products;

  const rows = [
    ["Posición", "Producto", "Categoría", "Unidades", "Hamburguesas", "Perros", "Ingresos", "Costo", "Ganancia", "Margen %"].join(";"),
  ];

  ranking.forEach((p, i) => {
    const profit = p.revenue - p.cost;
    rows.push([
      String(i + 1),
      csvText(p.name),
      csvText(p.category ?? ""),
      String(p.units),
      String(p.hamburguesas),
      String(p.perros),
      money(p.revenue),
      money(p.cost),
      money(profit),
      p.revenue > 0 && p.cost > 0 ? money((profit / p.revenue) * 100) : "",
    ].join(";"));
  });

  const csv = "﻿" + rows.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mas-vendidos_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
