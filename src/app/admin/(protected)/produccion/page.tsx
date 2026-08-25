import { createClient } from "@/lib/supabase/server";
import { ProductionManager } from "@/components/admin/production-manager";

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
      .select("id, name, unit")
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">COMPRAS DEL DÍA</h1>
        <p className="text-sm text-muted-foreground">
          Registra la materia prima que compraste para cocinar cada día
        </p>
      </header>

      <ProductionManager
        records={records}
        inventoryItems={(itemsRes.data as unknown as any[]) ?? []}
      />
    </div>
  );
}
