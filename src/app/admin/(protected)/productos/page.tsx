import { createClient } from "@/lib/supabase/server";
import {
  ProductManager,
  type ProductRow,
} from "@/components/admin/products/product-manager";
import { PageHeader } from "@/components/admin/page-header";

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
        .select("id, name, unit, cost")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("product_consumptions")
        .select("id, product_id, inventory_item_id, quantity, unit_cost, item:inventory_items(name, unit, cost)")
        .order("inventory_item_id"),
    ]);

  const inventoryItems = (inventoryRes.data ?? []) as unknown as InventoryRow[];
  const costByItem = new Map(
    inventoryItems.map((i) => [i.id, Number(i.cost) || 0])
  );

  const products = ((productsRes.data ?? []) as unknown as ProductRow[]).map(
    (p) => {
      const cons = (consumptionsRes.data ?? []).filter(
        (c) => c.product_id === p.id
      );
      const ingredientCost = cons.reduce(
        (sum, c) =>
          sum +
          Number(c.quantity) *
            (Number(c.unit_cost) || (costByItem.get(c.inventory_item_id) ?? 0)),
        0
      );
      return {
        ...p,
        autoCost: ingredientCost + (Number(p.packaging_cost) || 0),
      };
    }
  );

  const consumptions = ((consumptionsRes.data ?? []) as unknown as {
    id: string;
    product_id: string;
    inventory_item_id: string;
    quantity: number;
    unit_cost: number;
    item?: { name: string; unit: string; cost: number } | null;
  }[]).map((c) => ({
    ...c,
    item: c.item && !Array.isArray(c.item) ? c.item : null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Productos"
        description="Catálogo que verán tus clientes · precios en COP"
      />

      <ProductManager
        products={products}
        categories={categoriesRes.data ?? []}
        addons={addonsRes.data ?? []}
        inventoryItems={inventoryItems}
        consumptions={consumptions}
      />
    </div>
  );
}

interface InventoryRow {
  id: string;
  name: string;
  unit: string;
  cost: number;
}
