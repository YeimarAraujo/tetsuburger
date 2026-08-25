import { createClient } from "@/lib/supabase/server";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Auditoría · TETSUBURGER Admin",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const table = typeof params.table === "string" && params.table ? params.table : "all";
  const action = typeof params.action === "string" && params.action ? params.action : "all";

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, user_id, action, table_name, record_id, old_data, new_data, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (table !== "all") {
    query = query.eq("table_name", table);
  }
  if (action !== "all") {
    query = query.eq("action", action);
  }

  const { data } = await query;

  const tables = [...new Set((data ?? []).map((r) => r.table_name))];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide">AUDITORÍA</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todas las modificaciones al sistema · solo lectura
        </p>
      </header>

      <AuditLogViewer
        rows={(data as unknown as any[]) ?? []}
        currentTable={table}
        currentAction={action}
        availableTables={tables}
      />
    </div>
  );
}
