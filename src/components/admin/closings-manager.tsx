"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { closeDay, deleteClosing } from "@/features/closings/actions";
import { formatCOP, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ClosingRow {
  id: string;
  closing_date: string;
  orders_count: number;
  sales_total: number;
  expenses_total: number;
  estimated_profit: number;
  details: Record<string, unknown>;
}

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ClosingsManager({ rows }: { rows: ClosingRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(bogotaToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);

    const result = await closeDay(closingDate);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(`Cierre del ${closingDate} creado correctamente`);
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string, date: string) {
    if (!confirm(`¿Eliminar el cierre del ${date}? Podrás crearlo de nuevo si es necesario.`)) return;

    const result = await deleteClosing(id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Cierre del ${date} eliminado`);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Los cierres son inmutables: una vez creados no se pueden modificar ni
            eliminar.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Cerrar día
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No hay cierres registrados aún.
            </CardContent>
          </Card>
        ) : (
          rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <CalendarCheck className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{formatDate(`${row.closing_date}T12:00:00Z`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.orders_count} pedidos
                    </p>
                  </div>
                </div>

                <div className="ml-auto grid grid-cols-3 gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Ventas</p>
                    <p className="font-semibold text-emerald-600">
                      {formatCOP(Number(row.sales_total))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gastos</p>
                    <p className="font-semibold text-red-600">
                      {formatCOP(Number(row.expenses_total))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Utilidad</p>
                    <p className={`font-bold ${Number(row.estimated_profit) >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {formatCOP(Number(row.estimated_profit))}
                    </p>
                  </div>
                </div>

                <Badge variant="secondary" className="gap-1">
                  <Lock className="size-3" />
                  Inmutable
                </Badge>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.id, row.closing_date)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Diálogo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar el día</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se congelarán los totales de pedidos y gastos de esa fecha. Esta
              acción es irreversible.
            </p>
            <div className="space-y-2">
              <Label htmlFor="closing-date">Fecha a cerrar</Label>
              <Input
                id="closing-date"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                max={bogotaToday()}
              />
            </div>

            {rows.some((r) => r.closing_date === closingDate) ? (
              <p className="text-sm font-medium text-amber-600">
                Ya existe un cierre para esta fecha.
              </p>
            ) : null}

            {error ? (
              <p className="text-sm font-medium text-destructive">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving || rows.some((r) => r.closing_date === closingDate)}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarCheck className="size-4" />
                )}
                Cerrar día
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
