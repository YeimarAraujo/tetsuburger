import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exportación CSV del historial de compras (producción). Respeta los filtros from/to
 * del módulo Reportes y solo es accesible para personal autenticado.
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

  const { data: records } = await supabase
    .from("production_records")
    .select("record_date, description, quantity, unit, unit_cost, total_cost, item:inventory_items(name)")
    .gte("record_date", from)
    .lte("record_date", to)
    .order("record_date");

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines: string[] = [];
  let total = 0;

  lines.push(["Fecha", "Insumo", "Descripción", "Cantidad", "Unidad", "Costo/ud", "Costo total"].join(";"));

  for (const r of records ?? []) {
    const qty = Number(r.quantity);
    const unitCost = Number(r.unit_cost);
    const totalCost = Number(r.total_cost);
    total += totalCost;
    const itemName = (r.item as unknown as { name?: string } | null)?.name ?? "";
    lines.push([
      r.record_date,
      esc(itemName),
      esc(r.description ?? ""),
      String(qty).replace(".", ","),
      esc(r.unit ?? "unidad"),
      String(unitCost).replace(".", ","),
      String(totalCost).replace(".", ","),
    ].join(";"));
  }

  lines.push(["", "", "", "", "", "TOTAL", String(total).replace(".", ",")].join(";"));

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compras_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
