"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface AuditRow {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-emerald-500/10 text-emerald-700",
  UPDATE: "bg-blue-500/10 text-blue-700",
  DELETE: "bg-red-500/10 text-red-700",
};

const TABLE_LABELS: Record<string, string> = {
  orders: "Pedidos",
  order_items: "Items de pedido",
  products: "Productos",
  categories: "Categorías",
  addons: "Adicionales",
  expenses: "Gastos",
  daily_closings: "Cierres",
  inventory_items: "Inventario",
  settings: "Configuración",
  business_hours: "Horarios",
};

export function AuditLogViewer({
  rows,
  currentTable,
  currentAction,
  availableTables,
}: {
  rows: AuditRow[];
  currentTable: string;
  currentAction: string;
  availableTables: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function pushFilter(key: string, value: string) {
    const q = new URLSearchParams();
    if (key !== "table" || value !== "all") {
      if (key === "table") q.set("table", value);
      else q.set("table", currentTable);
    }
    if (key !== "action" || value !== "all") {
      if (key === "action") q.set("action", value);
      else q.set("action", currentAction);
    }
    const url = q.toString() ? `/admin/auditoria?${q}` : "/admin/auditoria";
    startTransition(() => router.push(url));
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="space-y-1.5">
            <Label>Tabla</Label>
            <Select value={currentTable} onValueChange={(v) => pushFilter("table", v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {[...new Set([...availableTables, "orders", "products", "expenses", "settings"])].map((t) => (
                  <SelectItem key={t} value={t}>{TABLE_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Acción</Label>
            <Select value={currentAction} onValueChange={(v) => pushFilter("action", v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">Crear</SelectItem>
                <SelectItem value="UPDATE">Editar</SelectItem>
                <SelectItem value="DELETE">Eliminar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No hay registros de auditoría.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 border-b pb-3 last:border-0"
                >
                  <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={ACTION_COLORS[row.action] ?? ""}
                      >
                        {row.action === "INSERT"
                          ? "Crear"
                          : row.action === "UPDATE"
                            ? "Editar"
                            : "Eliminar"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {TABLE_LABELS[row.table_name] ?? row.table_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.record_id.slice(0, 8)}
                      </span>
                    </div>
                    {row.old_data && row.new_data ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Cambios:{" "}
                        {Object.keys(row.new_data)
                          .filter(
                            (k) =>
                              k !== "updated_at" &&
                              JSON.stringify(row.new_data![k]) !==
                                JSON.stringify(row.old_data![k])
                          )
                          .slice(0, 3)
                          .join(", ") || "sin cambios visibles"}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
