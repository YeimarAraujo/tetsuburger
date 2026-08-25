import { createClient } from "@/lib/supabase/server";
import { AddonManager } from "@/components/admin/addons/addon-manager";

export const metadata = {
  title: "Adicionales · TETSUBURGER Admin",
};

export default async function AddonsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("addons")
    .select("*")
    .order("name");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Adicionales</h1>
        <p className="text-sm text-muted-foreground">
          Extras que el cliente puede agregar a los productos
        </p>
      </header>

      <AddonManager initial={data ?? []} />
    </div>
  );
}
