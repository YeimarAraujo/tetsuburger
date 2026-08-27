"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  error?: string;
}

const inventoryItemSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(60),
  unit: z.string().trim().max(30).default("unidad"),
  current_stock: z.coerce.number().min(0).default(0),
  min_stock: z.coerce.number().min(0).default(0),
});

const movementSchema = z.object({
  inventory_item_id: z.string().uuid("Selecciona un insumo válido"),
  movement_type: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  quantity: z.coerce.number().refine((n) => n !== 0, "La cantidad no puede ser 0"),
  reference: z.string().trim().max(200).default(""),
});

export async function createInventoryItem(input: unknown): Promise<ActionResult> {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    name: parsed.data.name,
    unit: parsed.data.unit,
    current_stock: parsed.data.current_stock,
    min_stock: parsed.data.min_stock,
  });

  if (error) return { error: "No se pudo crear el item" };
  revalidatePath("/admin/inventario");
  return {};
}

export async function updateInventoryItem(id: string, input: unknown): Promise<ActionResult> {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      name: parsed.data.name,
      unit: parsed.data.unit,
      current_stock: parsed.data.current_stock,
      min_stock: parsed.data.min_stock,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar" };
  revalidatePath("/admin/inventario");
  return {};
}

export async function registerMovement(input: unknown): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("inventory_movements").insert({
    inventory_item_id: data.inventory_item_id,
    movement_type: data.movement_type,
    quantity: Math.abs(data.quantity),
    reference: data.reference,
  });

  if (error) return { error: "No se pudo registrar el movimiento" };

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
