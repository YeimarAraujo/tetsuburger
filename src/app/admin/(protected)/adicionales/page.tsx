import { createClient } from "@/lib/supabase/server";
import { AddonManager } from "@/components/admin/addons/addon-manager";

export const metadata = {
  title: "Adicionales · TETSUBURGER Admin",
};

export default async function AddonsPage() {
  const supabase = await createClient();

  const [addonsRes, inventoryRes, addonConsRes] = await Promise.all([
    supabase.from("addons").select("*").order("name"),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("is_active", true)
      .order("name"),
    supabase.from("addon_consumptions").select(
      "id, addon_id, inventory_item_id, quantity, item:inventory_items(name, unit)"
    ),
  ]);

  const addonConsumptions = (addonConsRes.data ?? []).map((c) => ({
    id: c.id,
    addon_id: c.addon_id,
    inventory_item_id: c.inventory_item_id,
    quantity: Number(c.quantity),
    item: Array.isArray(c.item) ? c.item[0] : c.item,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Adicionales</h1>
        <p className="text-sm text-muted-foreground">
          Extras que el cliente puede agregar a los productos. Configura cuánto
          insumo descuenta cada adicional al entregar.
        </p>
      </header>

      <AddonManager
        initial={addonsRes.data ?? []}
        inventoryItems={inventoryRes.data ?? []}
        consumptions={addonConsumptions}
      />
    </div>
  );
}
