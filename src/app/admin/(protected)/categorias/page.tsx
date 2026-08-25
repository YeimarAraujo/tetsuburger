import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/admin/categories/category-manager";

export const metadata = {
  title: "Categorías · TETSUBURGER Admin",
};

export default async function CategoriesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("display_order")
    .order("name");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Secciones del menú que verá el cliente en el catálogo
        </p>
      </header>

      <CategoryManager initial={data ?? []} />
    </div>
  );
}
