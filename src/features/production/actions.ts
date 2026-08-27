"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
}

const purchaseSchema = z.object({
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  inventory_item_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(2, "La descripción es obligatoria").max(200),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unit: z.string().trim().max(30).default("unidad"),
  unit_cost: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(300).default(""),
});

const createItemSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(60),
  unit: z.string().trim().max(30).default("unidad"),
});

export async function createProductionRecord(input: unknown): Promise<ActionResult> {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const supabase = await createClient();
  const totalCost = data.quantity * data.unit_cost;

  const { error } = await supabase.from("production_records").insert({
    record_date: data.record_date,
    inventory_item_id: data.inventory_item_id ?? null,
    description: data.description,
    quantity: data.quantity,
    unit: data.unit,
    unit_cost: data.unit_cost,
    total_cost: totalCost,
    notes: data.notes,
  });

  if (error) return { error: "No se pudo registrar la compra: " + error.message };

  if (data.inventory_item_id) {
    await supabase.from("inventory_movements").insert({
      inventory_item_id: data.inventory_item_id,
      movement_type: "ENTRADA",
      quantity: data.quantity,
      reference: `Compra: ${data.description}`,
    });

    const { data: item } = await supabase
      .from("inventory_items")
      .select("current_stock")
      .eq("id", data.inventory_item_id)
      .single();

    if (item) {
      const newStock = Number(item.current_stock) + data.quantity;
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

export async function createItemFromPurchase(input: unknown): Promise<ActionResult & { id?: string }> {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      name: parsed.data.name,
      unit: parsed.data.unit,
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
