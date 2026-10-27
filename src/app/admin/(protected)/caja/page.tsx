import { createClient } from "@/lib/supabase/server";
import { CajaManager, type CajaRow } from "@/components/admin/caja-manager";
import { getCajaBase } from "@/features/caja/actions";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = {
  title: "Caja y Pagos · TETSU BURGER Admin",
};

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("caja_movements")
    .select("id, movement_date, tipo, metodo, amount, description, fuente, created_at")
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows: CajaRow[] = ((data ?? []) as unknown as {
    id: string;
    movement_date: string;
    tipo: CajaRow["tipo"];
    metodo: CajaRow["metodo"];
    amount: number | string;
    description: string;
    fuente: string;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    movement_date: r.movement_date,
    tipo: r.tipo,
    metodo: r.metodo,
    amount: Number(r.amount),
    description: r.description,
    fuente: r.fuente,
    created_at: r.created_at,
  }));

  const base = await getCajaBase();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Caja y Pagos"
        description="Saldos por medio de pago (efectivo y transferencia), arqueo diario y movimientos. Las ventas entregadas entran solas al saldo; las compras y gastos marcadas “sale de caja” se descuentan según el medio elegido."
      />

      <CajaManager rows={rows} base={base} />
    </div>
  );
}