"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
}

/**
 * Registra una compra de materia prima.
 * Si se asigna un insumo del inventario, automáticamente crea un movimiento
 * de ENTRADA y actualiza el stock actual.
 */
export async function createProductionRecord(input: unknown): Promise<ActionResult> {
  const data = input as {
    record_date: string;
    inventory_item_id: string | null;
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    notes: string;
  };

  if (!data.description?.trim()) return { error: "La descripción es obligatoria" };
  if (!data.quantity || data.quantity <= 0) return { error: "La cantidad debe ser mayor a 0" };

  const supabase = await createClient();

  const totalCost = Number(data.quantity) * Number(data.unit_cost || 0);

  // 1. Insertar el registro de compra
  const { error } = await supabase.from("production_records").insert({
    record_date: data.record_date || undefined,
    inventory_item_id: data.inventory_item_id || null,
    description: data.description.trim(),
    quantity: Number(data.quantity),
    unit: data.unit || "unidad",
    unit_cost: Number(data.unit_cost || 0),
    total_cost: totalCost,
    notes: data.notes || "",
  });

  if (error) return { error: "No se pudo registrar la compra: " + error.message };

  // 2. Si tiene insumo asociado, actualizar inventario automáticamente
  if (data.inventory_item_id) {
    // Crear movimiento ENTRADA
    await supabase.from("inventory_movements").insert({
      inventory_item_id: data.inventory_item_id,
      movement_type: "ENTRADA",
      quantity: Number(data.quantity),
      reference: `Compra: ${data.description.trim()}`,
    });

    // Actualizar stock del insumo
    const { data: item } = await supabase
      .from("inventory_items")
      .select("current_stock")
      .eq("id", data.inventory_item_id)
      .single();

    if (item) {
      const newStock = Number(item.current_stock) + Number(data.quantity);
      await supabase
        .from("inventory_items")
        .update({ current_stock: newStock })
        .eq("id", data.inventory_item_id);
    }
  }

  revalidatePath("/admin/produccion");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  return {};
}

/**
 * Crea un nuevo insumo en inventario desde el formulario de compras.
 */
export async function createItemFromPurchase(input: unknown): Promise<ActionResult & { id?: string }> {
  const data = input as { name: string; unit: string };

  if (!data.name?.trim()) return { error: "El nombre del insumo es obligatorio" };

  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      name: data.name.trim(),
      unit: data.unit || "unidad",
      current_stock: 0,
      min_stock: 0,
    })
    .select("id")
    .single();

  if (error) return { error: "No se pudo crear el insumo" };

  revalidatePath("/admin/produccion");
  revalidatePath("/admin/inventario");
  return { id: item.id };
}
