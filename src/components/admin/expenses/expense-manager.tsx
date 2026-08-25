"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  createExpense,
  updateExpense,
} from "@/features/expenses/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface ExpenseRow {
  id: string;
  expense_date: string;
  expense_category_id: number;
  concept: string;
  amount: number;
  description: string;
  category_name: string | null;
}

interface Filters {
  from: string;
  to: string;
  category: string; // "todas" o id
}

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function ExpenseManager({
  rows,
  categories,
  filters,
}: {
  rows: ExpenseRow[];
  categories: { id: number; name: string }[];
  filters: Filters;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.amount), 0),
    [rows]
  );

  function pushFilter(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    const q = new URLSearchParams();
    q.set("from", merged.from);
    q.set("to", merged.to);
    if (merged.category !== "todas") q.set("cat", merged.category);
    startTransition(() => router.push(`/admin/gastos?${q.toString()}`));
  }

  const exportHref = useMemo(() => {
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.category !== "todas") q.set("cat", filters.category);
    return `/admin/export/expenses?${q.toString()}`;
  }, [filters]);

  function openCreate() {
    setEditing(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(row: ExpenseRow) {
    setEditing(row);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      expense_date: String(formData.get("expense_date") ?? ""),
      expense_category_id: String(formData.get("expense_category_id") ?? ""),
      concept: String(formData.get("concept") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      description: String(formData.get("description") ?? ""),
    };

    const result = editing
      ? await updateExpense(editing.id, payload)
      : await createExpense(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(editing ? "Gasto actualizado" : "Gasto registrado");
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-from">Desde</Label>
            <Input
              id="f-from"
              type="date"
              value={filters.from}
              onChange={(e) => pushFilter({ from: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-to">Hasta</Label>
            <Input
              id="f-to"
              type="date"
              value={filters.to}
              onChange={(e) => pushFilter({ to: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select
              value={filters.category}
              onValueChange={(v) => pushFilter({ category: v })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Hoy", from: bogotaToday(), to: bogotaToday() },
              { label: "Ayer", from: shiftDays(-1), to: shiftDays(-1) },
              { label: "7 días", from: shiftDays(-6), to: bogotaToday() },
            ].map((r) => (
              <Button
                key={r.label}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => pushFilter({ from: r.from, to: r.to })}
              >
                {r.label}
              </Button>
            ))}
            {filters.category !== "todas" || filters.from !== "" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  pushFilter({
                    category: "todas",
                    from: `${bogotaToday().slice(0, 8)}01`,
                    to: bogotaToday(),
                  })
                }
              >
                <X className="size-3.5" />
                Limpiar
              </Button>
            ) : null}
          </div>

          <div className="ml-auto flex gap-2">
            <a href={exportHref}>
              <Button variant="outline" size="sm">
                <Download className="size-4" />
                Exportar CSV
              </Button>
            </a>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Nuevo gasto
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Total */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total del período</p>
            <p className="text-2xl font-bold text-destructive">{formatCOP(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Registros</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Promedio por registro</p>
            <p className="text-2xl font-bold">
              {formatCOP(rows.length > 0 ? Math.round(total / rows.length) : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos</CardTitle>
          <CardDescription>
            {filters.from} → {filters.to} · los gastos nunca se eliminan: se
            corrigen editándolos (queda auditoría)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Fecha</th>
                  <th className="pb-2 pr-2 font-medium">Categoría</th>
                  <th className="pb-2 pr-2 font-medium">Concepto</th>
                  <th className="hidden pb-2 pr-2 font-medium md:table-cell">Descripción</th>
                  <th className="pb-2 pr-2 text-right font-medium">Valor</th>
                  <th className="pb-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No hay gastos en este período.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-3 pr-2 whitespace-nowrap">{formatDate(`${row.expense_date}T12:00:00Z`)}</td>
                      <td className="py-3 pr-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {row.category_name ?? "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-medium">{row.concept}</td>
                      <td className="hidden max-w-[220px] truncate py-3 pr-2 text-muted-foreground md:table-cell">
                        {row.description || "—"}
                      </td>
                      <td className="py-3 pr-2 text-right font-semibold text-destructive">
                        −{formatCOP(Number(row.amount))}
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-date">Fecha *</Label>
                <Input
                  id="exp-date"
                  name="expense_date"
                  type="date"
                  defaultValue={editing?.expense_date ?? bogotaToday()}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-cat">Categoría *</Label>
                <Select name="expense_category_id" defaultValue={editing ? String(editing.expense_category_id) : undefined} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-concept">Concepto *</Label>
              <Input
                id="exp-concept"
                name="concept"
                defaultValue={editing?.concept ?? ""}
                placeholder="Ej: Carne para 50 hamburguesas"
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-amount">Valor (COP) *</Label>
              <Input
                id="exp-amount"
                name="amount"
                type="number"
                min={0}
                step={100}
                defaultValue={editing?.amount ?? ""}
                placeholder="150000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-desc">Descripción</Label>
              <Textarea
                id="exp-desc"
                name="description"
                defaultValue={editing?.description ?? ""}
                rows={2}
                maxLength={500}
                placeholder="Detalle opcional"
              />
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : editing ? (
                  "Guardar cambios"
                ) : (
                  "Registrar gasto"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
