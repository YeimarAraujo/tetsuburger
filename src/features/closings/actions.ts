"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  error?: string;
  success?: boolean;
  closing_date?: string;
}

/**
 * Cierra el día: calcula totales de pedidos + gastos y crea un registro
 * inmutable en daily_closings. El trigger trg_daily_closings_protect
 * bloquea cualquier UPDATE/DELETE posterior.
 */
export async function closeDay(date: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Fecha inválida" };
  }

  const admin = createAdminClient();

  // 1. Verificar que no exista ya un cierre para esta fecha
  const { data: existing } = await admin
    .from("daily_closings")
    .select("id")
    .eq("closing_date", date)
    .maybeSingle();

  if (existing) {
    return { error: "Ya existe un cierre para esta fecha" };
  }

  // 2. Calcular totales de pedidos del día
  const { data: ordersResult } = await admin
    .from("orders")
    .select("id, total, status, payment_method")
    .gte("created_at", `${date}T00:00:00-05:00`)
    .lte("created_at", `${date}T23:59:59-05:00`);

  const orders = ordersResult ?? [];
  const validOrders = orders.filter((o) => o.status !== "CANCELADO");
  const ordersCount = validOrders.length;
  const salesTotal = validOrders.reduce((s, o) => s + Number(o.total), 0);

  // 3. Calcular totales de gastos
  const { data: expenses } = await admin
    .from("expenses")
    .select("id, amount")
    .eq("expense_date", date);

  const expensesTotal = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // 4. Desglose por método de pago
  const byPayment = validOrders.reduce(
    (acc, o) => {
      const method = o.payment_method ?? "EFECTIVO";
      acc[method] = (acc[method] || 0) + Number(o.total);
      return acc;
    },
    {} as Record<string, number>
  );

  // 5. Insertar cierre (service_role, sin RLS)
  const { error } = await admin.from("daily_closings").insert({
    closing_date: date,
    orders_count: ordersCount,
    sales_total: salesTotal,
    expenses_total: expensesTotal,
    estimated_profit: salesTotal - expensesTotal,
    details: {
      by_payment: byPayment,
      total_orders: orders.length,
      cancelled_orders: orders.length - ordersCount,
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
  const admin = createAdminClient();
  const { error } = await admin.from("daily_closings").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar: " + error.message };

  revalidatePath("/admin/cierres");
  revalidatePath("/admin");
  return {};
}
