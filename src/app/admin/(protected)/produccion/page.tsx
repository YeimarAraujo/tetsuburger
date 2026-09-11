import { createClient } from "@/lib/supabase/server";
import { ProductionManager } from "@/components/admin/production-manager";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compras del día · TETSUBURGER Admin",
};

export default async function ProductionPage() {
  const supabase = await createClient();

  const [recordsRes, itemsRes] = await Promise.all([
    supabase
      .from("production_records")
      .select("id, record_date, description, quantity, unit, unit_cost, total_cost, notes, item:inventory_items(name)")
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inventory_items")
      .select("id, name, unit, barcode")
      .eq("is_active", true)
      .order("name"),
  ]);

  const records = ((recordsRes.data ?? []) as unknown as {
    id: string;
    record_date: string;
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    total_cost: number;
    notes: string;
    item?: { name: string } | null;
  }[]).map((r) => ({
    ...r,
    item: r.item && !Array.isArray(r.item) ? r.item : null,
  }));

  const inventoryItems = ((itemsRes.data ?? []) as unknown as {
    id: string;
    name: string;
    unit: string;
    barcode: string | null;
  }[]).map((i) => ({
    ...i,
    barcode: i.barcode ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Compras del día"
        description="Registra la materia prima que compraste para cocinar cada día"
      />

      <ProductionManager
        records={records}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}
