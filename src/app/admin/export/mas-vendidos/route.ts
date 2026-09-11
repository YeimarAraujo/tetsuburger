import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  countSales,
  productCountMap,
  type SaleLine,
} from "@/lib/sales-counting";

/**
 * Exportación CSV del ranking "Más vendidos" de Reportes. Respeta los filtros
 * from/to y el tipo (todos | hamburguesas | perros). Solo staff autenticado.
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
  const tipo = params.get("tipo") === "hamburguesas" || params.get("tipo") === "perros" ? params.get("tipo") : "todos";

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status")
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59-05:00`);

  const activeIds = (orders ?? [])
    .filter((o) => o.status !== "CANCELADO")
    .map((o) => o.id);

  let ranking: ReturnType<typeof countSales>["byProduct"] = [];
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

    const hits = countSales(saleLines, productCounts).byProduct;
    ranking =
      tipo === "hamburguesas"
        ? hits.filter((h) => h.hamburguesas > 0).sort((a, b) => b.hamburguesas - a.hamburguesas)
        : tipo === "perros"
          ? hits.filter((h) => h.perros > 0).sort((a, b) => b.perros - a.perros)
          : hits;
  }

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const rows = [["Posición", "Producto", "Unidades", "Hamburguesas", "Perros", "Ingresos"].join(";")];

  ranking.forEach((h, i) => {
    rows.push([
      String(i + 1),
      esc(h.name),
      String(h.units),
      String(h.hamburguesas),
      String(h.perros),
      String(h.ingresos).replace(".", ","),
    ].join(";"));
  });

  const csv = "\uFEFF" + rows.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mas-vendidos_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}