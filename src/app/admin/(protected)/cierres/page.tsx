import { createClient } from "@/lib/supabase/server";
import { ClosingsManager } from "@/components/admin/closings-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cierres Diarios · TETSUBURGER Admin",
};

export default async function ClosingsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("daily_closings")
    .select("*")
    .order("closing_date", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">CIERRES DIARIOS</h1>
        <p className="text-sm text-muted-foreground">
          Congela los totales de cada día. Los cierres son inmutables.
        </p>
      </header>

      <ClosingsManager rows={(rows as unknown as any[]) ?? []} />
    </div>
  );
}
