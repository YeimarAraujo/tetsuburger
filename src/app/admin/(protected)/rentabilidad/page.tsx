import { createClient } from "@/lib/supabase/server";
import { RentabilidadManager } from "@/components/admin/rentabilidad/rentabilidad-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rentabilidad de productos · TETSUBURGER Admin",
};

export default async function RentabilidadPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, price, cost, is_active, category:categories(name)")
    .eq("is_active", true)
    .order("name");

  const products = ((data ?? []) as unknown as {
    id: string;
    name: string;
    price: number | string;
    cost: number | string;
    is_active: boolean;
    category?: { name: string } | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    cost: Number(p.cost),
    category: p.category && !Array.isArray(p.category) ? p.category : null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">RENTABILIDAD</h1>
        <p className="text-sm text-muted-foreground">
          Margen bruto por producto según precio de venta y costo
        </p>
      </header>

      <RentabilidadManager products={products} />
    </div>
  );
}
