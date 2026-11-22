import { createClient } from "@/lib/supabase/server";
import { CajaManager, type CajaRow } from "@/components/admin/caja-manager";
import { PageHeader } from "@/components/admin/page-header";
import type { SocioMovRow, SocioRow } from "@/components/admin/caja-socios-card";

export const metadata = {
  title: "Caja y Pagos · TETSU BURGER Admin",
};

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("caja_movements")
    .select("id, movement_date, tipo, metodo, bolsillo, amount, description, fuente, created_at")
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows: CajaRow[] = ((data ?? []) as unknown as {
    id: string;
    movement_date: string;
    tipo: CajaRow["tipo"];
    metodo: CajaRow["metodo"];
    bolsillo: CajaRow["bolsillo"] | null;
    amount: number | string;
    description: string;
    fuente: string;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    movement_date: r.movement_date,
    tipo: r.tipo,
    metodo: r.metodo,
    bolsillo: r.bolsillo ?? "GANANCIA",
    amount: Number(r.amount),
    description: r.description,
    fuente: r.fuente,
    created_at: r.created_at,
  }));

  const [{ data: sociosData }, { data: sociosMovData }] = await Promise.all([
    supabase
      .from("caja_socios")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("caja_socio_movimientos")
      .select("id, socio_id, tipo, movement_date, amount, metodo, bolsillo, description, created_at")
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const socios: SocioRow[] = ((sociosData ?? []) as unknown as SocioRow[]).map((s) => ({
    id: s.id,
    nombre: s.nombre,
  }));

  const socioMovs: SocioMovRow[] = ((sociosMovData ?? []) as unknown as (Omit<SocioMovRow, "amount"> & {
    amount: number | string;
  })[]).map((m) => ({ ...m, amount: Number(m.amount) }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Caja y Pagos"
        description=" "
      />

      <CajaManager rows={rows} socios={socios} socioMovs={socioMovs} />
    </div>
  );
}
