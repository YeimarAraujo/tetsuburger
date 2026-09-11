import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/admin/categories/category-manager";
import { PageHeader } from "@/components/admin/page-header";

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
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Categorías"
        description="Secciones del menú que verá el cliente en el catálogo"
      />

      <CategoryManager initial={data ?? []} />
    </div>
  );
}
