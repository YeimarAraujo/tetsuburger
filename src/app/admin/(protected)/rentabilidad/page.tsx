import { createClient } from "@/lib/supabase/server";
import { getBusinessCosts } from "@/features/rentabilidad/actions";
import { RentabilidadManager } from "@/components/admin/rentabilidad/rentabilidad-manager";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rentabilidad · TETSUBURGER Admin",
};

export default async function RentabilidadPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, price, cost, packaging_cost, is_active, category:categories(name)")
    .eq("is_active", true)
    .order("name");

  const products = ((data ?? []) as unknown as {
    id: string;
    name: string;
    price: number | string;
    cost: number | string;
    packaging_cost: number | string;
    is_active: boolean;
    category?: { name: string } | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    cost: Number(p.cost),
    packaging_cost: Number(p.packaging_cost ?? 0),
    category: p.category && !Array.isArray(p.category) ? p.category : null,
  }));

  const initialConfig = await getBusinessCosts();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Rentabilidad"
        description="Costo completo por producto (ingredientes + empaque + costos fijos) y precio sugerido"
      />
      <RentabilidadManager products={products} initialConfig={initialConfig} />
    </div>
  );
}
