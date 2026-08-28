import { createClient } from "@/lib/supabase/server";
import {
  ProductManager,
  type ProductRow,
} from "@/components/admin/products/product-manager";

export const metadata = {
  title: "Productos · TETSUBURGER Admin",
};

export default async function ProductsPage() {
  const supabase = await createClient();

  const [productsRes, categoriesRes, addonsRes, inventoryRes, consumptionsRes] =
    await Promise.all([
      supabase
        .from("products")
        .select("*, category:categories(name), product_addons(addon_id)")
        .order("name"),
      supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("addons").select("*").order("name"),
      supabase
        .from("inventory_items")
        .select("id, name, unit")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("product_consumptions")
        .select("id, product_id, inventory_item_id, quantity, item:inventory_items(name, unit)")
        .order("inventory_item_id"),
    ]);

  const products = (productsRes.data ?? []) as unknown as ProductRow[];

  const consumptions = ((consumptionsRes.data ?? []) as unknown as {
    id: string;
    product_id: string;
    inventory_item_id: string;
    quantity: number;
    item?: { name: string; unit: string } | null;
  }[]).map((c) => ({
    ...c,
    item: c.item && !Array.isArray(c.item) ? c.item : null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo que verán tus clientes · precios en COP
        </p>
      </header>

      <ProductManager
        products={products}
        categories={categoriesRes.data ?? []}
        addons={addonsRes.data ?? []}
        inventoryItems={(inventoryRes.data as unknown as InventoryRow[]) ?? []}
        consumptions={consumptions}
      />
    </div>
  );
}

interface InventoryRow {
  id: string;
  name: string;
  unit: string;
}
