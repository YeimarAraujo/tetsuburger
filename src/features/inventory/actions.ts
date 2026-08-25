"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  error?: string;
}

export async function createInventoryItem(input: unknown): Promise<ActionResult> {
  const data = input as { name: string; unit: string; current_stock: number; min_stock: number };
  if (!data.name?.trim()) return { error: "El nombre es obligatorio" };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    name: data.name.trim(),
    unit: data.unit || "unidad",
    current_stock: Number(data.current_stock) || 0,
    min_stock: Number(data.min_stock) || 0,
  });

  if (error) return { error: "No se pudo crear el item" };
  revalidatePath("/admin/inventario");
  return {};
}

export async function updateInventoryItem(id: string, input: unknown): Promise<ActionResult> {
  const data = input as { name: string; unit: string; current_stock: number; min_stock: number };
  if (!data.name?.trim()) return { error: "El nombre es obligatorio" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      name: data.name.trim(),
      unit: data.unit || "unidad",
      current_stock: Number(data.current_stock) || 0,
      min_stock: Number(data.min_stock) || 0,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar" };
  revalidatePath("/admin/inventario");
  return {};
}

export async function registerMovement(input: unknown): Promise<ActionResult> {
  const data = input as {
    inventory_item_id: string;
    movement_type: string;
    quantity: number;
    reference: string;
  };

  if (!data.inventory_item_id) return { error: "Selecciona un insumo" };
  if (!data.quantity || data.quantity === 0) return { error: "La cantidad no puede ser 0" };

  const supabase = await createClient();

  // Registrar movimiento
  const { error } = await supabase.from("inventory_movements").insert({
    inventory_item_id: data.inventory_item_id,
    movement_type: data.movement_type,
    quantity: Math.abs(data.quantity),
    reference: data.reference || "",
  });

  if (error) return { error: "No se pudo registrar el movimiento" };

  // Actualizar stock del item
  const { data: item } = await supabase
    .from("inventory_items")
    .select("current_stock")
    .eq("id", data.inventory_item_id)
    .single();

  if (item) {
    let newStock = Number(item.current_stock);
    switch (data.movement_type) {
      case "ENTRADA":
        newStock += Math.abs(data.quantity);
        break;
      case "SALIDA":
        newStock -= Math.abs(data.quantity);
        break;
      case "AJUSTE":
        newStock = Math.abs(data.quantity);
        break;
    }

    await supabase
      .from("inventory_items")
      .update({ current_stock: Math.max(0, newStock) })
      .eq("id", data.inventory_item_id);
  }

  revalidatePath("/admin/inventario");
  return {};
}
