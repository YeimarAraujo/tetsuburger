import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exportación CSV de gastos. Respeta los filtros del módulo (from/to/cat)
 * y solo es accesible para personal autenticado.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

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

  let query = supabase
    .from("expenses")
    .select(
      "expense_date, concept, amount, description, category:expense_categories(name)"
    )
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date")
    .order("created_at");

  if (cat && cat !== "todas") {
    query = query.eq("expense_category_id", Number(cat));
  }

  const { data, error } = await query;

  if (error) {
    return new NextResponse("Error generando la exportación", { status: 500 });
  }

  // BOM para que Excel respete UTF-8; separador ';' para Excel en español
  const header = ["Fecha", "Categoria", "Concepto", "Valor", "Descripcion"];
  const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;

  const lines = [header.join(";")];
  let total = 0;

  for (const row of data ?? []) {
    const amount = Number(row.amount);
    total += amount;
    const categoryName =
      (row.category as unknown as { name?: string } | null)?.name ?? "";
    lines.push(
      [
        row.expense_date,
        escape(categoryName),
        escape(row.concept),
        String(amount).replace(".", ","),
        escape(row.description ?? ""),
      ].join(";")
    );
  }

  lines.push(["", "", "TOTAL", String(total).replace(".", ","), ""].join(";"));

  const csv = "\uFEFF" + lines.join("\r\n");
  const filename = `gastos_${from}_${to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
