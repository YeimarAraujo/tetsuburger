"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
}

const setConsumptionSchema = z.object({
  productId: z.string().uuid(),
  inventoryItemId: z.string().uuid("Selecciona un insumo válido"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
});

const idSchema = z.string().uuid("ID inválido");

const copySchema = z.object({
  fromProductId: z.string().uuid(),
  toProductId: z.string().uuid(),
});

/**
 * Crea o actualiza el consumo de un insumo para un producto.
 */
export async function setProductConsumption(
  productId: string,
  inventoryItemId: string,
  quantity: number
): Promise<ActionResult> {
  const parsed = setConsumptionSchema.safeParse({
    productId,
    inventoryItemId,
    quantity,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { error } = await supabase.from("product_consumptions").upsert(
    {
      product_id: parsed.data.productId,
      inventory_item_id: parsed.data.inventoryItemId,
      quantity: parsed.data.quantity,
    },
    { onConflict: "product_id,inventory_item_id" }
  );

  if (error) {
    return {
      error: `No se pudo agregar el insumo: ${error.message}. Verifica que la migración 0006 (tabla product_consumptions) esté aplicada.`,
    };
  }

  revalidatePath("/admin/productos");
  return {};
}

/**
 * Elimina un consumo de insumo de un producto.
 */
export async function deleteProductConsumption(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_consumptions")
    .delete()
    .eq("id", parsed.data);

  if (error) return { error: "No se pudo eliminar el consumo" };

  revalidatePath("/admin/productos");
  return {};
}

/**
 * Copia todos los consumos de FROM a TO (reemplaza los existentes en TO).
 * Utilidad para agilizar el alta de productos similares.
 */
export async function copyConsumptions(
  fromProductId: string,
  toProductId: string
): Promise<ActionResult> {
  const parsed = copySchema.safeParse({ fromProductId, toProductId });
  if (!parsed.success) return { error: "Datos inválidos" };
  if (parsed.data.fromProductId === parsed.data.toProductId) {
    return { error: "No puedes copiar de un producto a sí mismo" };
  }

  const supabase = await createClient();

  const { data: source } = await supabase
    .from("product_consumptions")
    .select("inventory_item_id, quantity")
    .eq("product_id", parsed.data.fromProductId);

  if (!source || source.length === 0) {
    return { error: "El producto origen no tiene consumos configurados" };
  }

  // Reemplaza: borra consumos actuales del destino y copia los del origen
  await supabase
    .from("product_consumptions")
    .delete()
    .eq("product_id", parsed.data.toProductId);

  const { error } = await supabase.from("product_consumptions").insert(
    source.map((c) => ({
      product_id: parsed.data.toProductId,
      inventory_item_id: c.inventory_item_id,
      quantity: c.quantity,
    }))
  );

  if (error) return { error: "No se pudieron copiar los consumos" };

  revalidatePath("/admin/productos");
  return {};
}

/* ----------------------------------------------------------------------------
 * CONSUMO DE INSUMOS POR ADICIÓN (extras que descuentan inventario)
 * -------------------------------------------------------------------------- */

const setAddonConsumptionSchema = z.object({
  addonId: z.string().uuid(),
  inventoryItemId: z.string().uuid("Selecciona un insumo válido"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
});

/**
 * Crea o actualiza el consumo de un insumo para una adición.
 */
export async function setAddonConsumption(
  addonId: string,
  inventoryItemId: string,
  quantity: number
): Promise<ActionResult> {
  const parsed = setAddonConsumptionSchema.safeParse({
    addonId,
    inventoryItemId,
    quantity,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { error } = await supabase.from("addon_consumptions").upsert(
    {
      addon_id: parsed.data.addonId,
      inventory_item_id: parsed.data.inventoryItemId,
      quantity: parsed.data.quantity,
    },
    { onConflict: "addon_id,inventory_item_id" }
  );

  if (error) {
    return {
      error: `No se pudo agregar el insumo: ${error.message}. Verifica que la migración 0008 (tabla addon_consumptions) esté aplicada.`,
    };
  }

  revalidatePath("/admin/adicionales");
  return {};
}

/**
 * Elimina un consumo de insumo de una adición.
 */
export async function deleteAddonConsumption(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("addon_consumptions")
    .delete()
    .eq("id", parsed.data);

  if (error) return { error: "No se pudo eliminar el consumo" };

  revalidatePath("/admin/adicionales");
  return {};
}

/**
 * Copia todos los consumos de una adición FROM a otra TO (reemplaza).
 */
export async function copyAddonConsumptions(
  fromAddonId: string,
  toAddonId: string
): Promise<ActionResult> {
  const parsed = copySchema.safeParse({
    fromProductId: fromAddonId,
    toProductId: toAddonId,
  });
  if (!parsed.success) return { error: "Datos inválidos" };
  if (parsed.data.fromProductId === parsed.data.toProductId) {
    return { error: "No puedes copiar de una adición a sí misma" };
  }

  const supabase = await createClient();

  const { data: source } = await supabase
    .from("addon_consumptions")
    .select("inventory_item_id, quantity")
    .eq("addon_id", parsed.data.fromProductId);

  if (!source || source.length === 0) {
    return { error: "La adición origen no tiene consumos configurados" };
  }

  await supabase
    .from("addon_consumptions")
    .delete()
    .eq("addon_id", parsed.data.toProductId);

  const { error } = await supabase.from("addon_consumptions").insert(
    source.map((c) => ({
      addon_id: parsed.data.toProductId,
      inventory_item_id: c.inventory_item_id,
      quantity: c.quantity,
    }))
  );

  if (error) return { error: "No se pudieron copiar los consumos" };

  revalidatePath("/admin/adicionales");
  return {};
}
