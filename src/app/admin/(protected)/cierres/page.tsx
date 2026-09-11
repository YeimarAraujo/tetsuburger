import { createClient } from "@/lib/supabase/server";
import { ClosingsManager, type ClosingRow } from "@/components/admin/closings-manager";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cierres diarios · TETSUBURGER Admin",
};

export default async function ClosingsPage() {
  const supabase = await createClient();

  const { data: rawRows } = await supabase
    .from("daily_closings")
    .select("*")
    .order("closing_date", { ascending: false });

  const rows = ((rawRows ?? []) as unknown as ClosingRow[]).map((r) => ({
    ...r,
    sales_total: Number(r.sales_total),
    expenses_total: Number(r.expenses_total),
    estimated_profit: Number(r.estimated_profit),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Cierres diarios"
        description="Congela los totales de cada día. Los cierres son inmutables."
      />

      <ClosingsManager rows={rows} />
    </div>
  );
}
