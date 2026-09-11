"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCogsForOrders, sumCogs } from "@/features/finance/cogs";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  error?: string;
  success?: boolean;
  closing_date?: string;
}

const closingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const closingIdSchema = z.string().uuid("ID inválido");

async function assertAuth(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? null : "No autorizado";
}

/**
 * Cierra el día: calcula totales de pedidos + gastos y crea un registro
 * inmutable en daily_closings.
 */
export async function closeDay(date: string): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  const dateParsed = closingDateSchema.safeParse(date);
  if (!dateParsed.success) {
    return { error: "Fecha inválida" };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("daily_closings")
    .select("id")
    .eq("closing_date", date)
    .maybeSingle();

  if (existing) {
    return { error: "Ya existe un cierre para esta fecha" };
  }

  const { data: ordersResult } = await admin
    .from("orders")
    .select("id, subtotal, total, delivery_fee, delivery_fee_retained, status, payment_method")
    .gte("created_at", `${date}T00:00:00-05:00`)
    .lte("created_at", `${date}T23:59:59-05:00`);

  const orders = ordersResult ?? [];
  const allOrdersCount = orders.length;
  const cancelledOrders = orders.filter((o) => o.status === "CANCELADO").length;

  // Las ventas del cierre son SOLO los pedidos ENTREGADO (máximo realismo).
  // Los ingresos cuentan solo el valor de los productos (subtotal); los
  // domicilios no se incluyen: ni retenidos ni externos.
  const deliveredOrders = orders.filter((o) => o.status === "ENTREGADO");
  const ordersCount = deliveredOrders.length;

  const subtotalSales = deliveredOrders.reduce((s, o) => s + Number(o.subtotal), 0);
  const salesTotal = subtotalSales;

  // Costo de lo vendido: Σ (products.cost × cantidad) de los pedidos ENTREGADO.
  const { map: cogsByOrder, missingCostCount } = await getCogsForOrders(
    deliveredOrders.map((o) => o.id)
  );
  const cogsTotal = sumCogs(cogsByOrder);

  const { data: expenses } = await admin
    .from("expenses")
    .select("id, amount")
    .eq("expense_date", date);

  const expensesTotal = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // Caja esperada del día: solo efectivo físico (el arqueo compara contra la
  // plata contada en el cajón; las transferencias van al banco). Suma los
  // movimientos de caja_movements del día en EFECTIVO.
  const { data: cajaMovements } = await admin
    .from("caja_movements")
    .select("amount")
    .eq("movement_date", date)
    .eq("metodo", "EFECTIVO");
  const cajaEsperada = (cajaMovements ?? []).reduce((s, m) => s + Number(m.amount), 0);

  // Utilidad = ventas de productos entregados − costo de lo vendido − gastos.
  const estimatedProfit = salesTotal - cogsTotal - expensesTotal;

  const byPayment = deliveredOrders.reduce(
    (acc, o) => {
      const method = o.payment_method ?? "EFECTIVO";
      acc[method] = (acc[method] || 0) + Number(o.subtotal);
      return acc;
    },
    {} as Record<string, number>
  );

  const { error } = await admin.from("daily_closings").insert({
    closing_date: date,
    orders_count: ordersCount,
    sales_total: salesTotal,
    expenses_total: expensesTotal,
    estimated_profit: estimatedProfit,
    details: {
      by_payment: byPayment,
      total_orders: allOrdersCount,
      cancelled_orders: cancelledOrders,
      subtotal_sales: subtotalSales,
      delivered_orders: ordersCount,
      cogs_total: cogsTotal,
      missing_cost_products: missingCostCount,
      caja_esperada: cajaEsperada,
      includes_domicilios: false,
    },
  });

  if (error) {
    return { error: "No se pudo crear el cierre: " + error.message };
  }

  revalidatePath("/admin/cierres");
  revalidatePath("/admin");
  return { success: true, closing_date: date };
}

export async function deleteClosing(id: string): Promise<ActionResult> {
  const authError = await assertAuth();
  if (authError) return { error: authError };

  const idParsed = closingIdSchema.safeParse(id);
  if (!idParsed.success) {
    return { error: "ID inválido" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("daily_closings").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar: " + error.message };

  revalidatePath("/admin/cierres");
  revalidatePath("/admin");
  return {};
}
