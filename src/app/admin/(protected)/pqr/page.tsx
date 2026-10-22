import { createAdminClient } from "@/lib/supabase/admin";
import { PqrManager, type PqrRow } from "@/components/admin/pqr-manager";

export const dynamic = "force-dynamic";

export default async function AdminPqrPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pqr_requests")
    .select("id, name, email, phone, type, message, status, policy_version, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PQR</h1>
        <p className="text-sm text-muted-foreground">
          Peticiones, quejas y reclamos recibidos desde el sitio.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No se pudo cargar la bandeja. Verifica que la migración de PQR esté
          aplicada en Supabase.
        </div>
      ) : (
        <PqrManager requests={(data ?? []) as PqrRow[]} />
      )}
    </div>
  );
}
