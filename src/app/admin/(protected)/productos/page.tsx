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

  const [productsRes, categoriesRes, addonsRes] = await Promise.all([
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
  ]);

  const products = (productsRes.data ?? []) as unknown as ProductRow[];

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
      />
    </div>
  );
}
