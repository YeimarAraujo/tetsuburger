import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/admin/inventory-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inventario · TETSUBURGER Admin",
};

export default async function InventoryPage() {
  const supabase = await createClient();

  const [itemsRes, movementsRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .order("name"),
    supabase
      .from("inventory_movements")
      .select("id, inventory_item_id, movement_type, quantity, reference, created_at, item:inventory_items(name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const movements = ((movementsRes.data ?? []) as unknown as {
    id: string;
    inventory_item_id: string;
    movement_type: string;
    quantity: number;
    reference: string;
    created_at: string;
    item?: { name: string } | null;
  }[]).map((m) => ({
    ...m,
    item: m.item && !Array.isArray(m.item) ? m.item : null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">INVENTARIO</h1>
        <p className="text-sm text-muted-foreground">
          Control de insumos y stock del negocio
        </p>
      </header>

      <InventoryManager
        items={(itemsRes.data as unknown as any[]) ?? []}
        movements={movements}
      />
    </div>
  );
}
