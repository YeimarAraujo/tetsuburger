"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Coins, CreditCard, Loader2, Plus, Scale, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { createCajaMovement, deleteCajaMovement } from "@/features/caja/actions";
import { formatCOP, formatDate } from "@/lib/format";
import { bogotaToday } from "@/lib/bogota";
import type { CajaMetodo, CajaTipo } from "@/types/db";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/admin/kpi-card";

export interface CajaRow {
  id: string;
  movement_date: string;
  tipo: CajaTipo;
  metodo: CajaMetodo;
  amount: number;
  description: string;
  fuente: string;
  created_at: string;
}

const MANUAL_TIPOS: CajaTipo[] = ["INGRESO_EXTRA", "RETIRO", "AJUSTE"];

const METODO_META: Record<CajaMetodo, { label: string; className: string }> = {
  EFECTIVO: { label: "Efectivo", className: "bg-emerald-500/10 text-emerald-600" },
  TRANSFERENCIA: { label: "Transferencia", className: "bg-blue-500/10 text-blue-600" },
};

const TIPO_META: Record<CajaTipo, { label: string; className: string }> = {
  VENTA_EFECTIVO: { label: "Venta en efectivo", className: "bg-emerald-500/10 text-emerald-600" },
  VENTA_TRANSFERENCIA: { label: "Venta por transferencia", className: "bg-blue-500/10 text-blue-600" },
  COMPRA: { label: "Compra", className: "bg-amber-500/10 text-amber-700" },
  GASTO: { label: "Gasto", className: "bg-red-500/10 text-red-600" },
  INGRESO_EXTRA: { label: "Ingreso extra", className: "bg-emerald-500/10 text-emerald-600" },
  RETIRO: { label: "Retiro", className: "bg-orange-500/10 text-orange-600" },
  AJUSTE: { label: "Ajuste", className: "bg-blue-500/10 text-blue-600" },
};

function moveMonth(days: number, from: string): string {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CajaManager({ rows }: { rows: CajaRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(() => `${bogotaToday().slice(0, 8)}01`);
  const [to, setTo] = useState(bogotaToday());

  const [arqueoDate, setArqueoDate] = useState(bogotaToday());
  const [contado, setContado] = useState("");
  const [manTipo, setManTipo] = useState<"INGRESO_EXTRA" | "RETIRO" | "AJUSTE">("INGRESO_EXTRA");
  const [manIngreso, setManIngreso] = useState(false);
  const [manMetodo, setManMetodo] = useState<CajaMetodo>("EFECTIVO");

  const saldo = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows]);
  const saldoEfectivo = useMemo(
    () => rows.filter((r) => r.metodo === "EFECTIVO").reduce((s, r) => s + Number(r.amount), 0),
    [rows]
  );
  const saldoTransferencia = useMemo(
    () => rows.filter((r) => r.metodo === "TRANSFERENCIA").reduce((s, r) => s + Number(r.amount), 0),
    [rows]
  );

  const filtered = useMemo(
    () => rows.filter((r) => r.movement_date >= from && r.movement_date <= to),
    [rows, from, to]
  );
  const ingresos = filtered.filter((r) => r.amount > 0).reduce((s, r) => s + Number(r.amount), 0);
  const egresos = filtered.filter((r) => r.amount < 0).reduce((s, r) => s + Number(r.amount), 0);

  const dayRows = useMemo(
    () => rows.filter((r) => r.movement_date === arqueoDate),
    [rows, arqueoDate]
  );
  // El arqueo compara contra la plata física del cajón: solo efectivo.
  const esperado = dayRows
    .filter((r) => r.metodo === "EFECTIVO")
    .reduce((s, r) => s + Number(r.amount), 0);
  const diff = (Number(contado) || 0) - esperado;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      movement_date: String(fd.get("movement_date") ?? bogotaToday()),
      tipo: manTipo,
      metodo: manTipo === "AJUSTE" ? "EFECTIVO" : manMetodo,
      es_ingreso: String(manIngreso),
      amount: String(fd.get("amount") ?? ""),
      description: String(fd.get("description") ?? ""),
    };

    const result = await createCajaMovement(payload);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success("Movimiento registrado en la caja");
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleAjuste() {
    if (diff === 0) return;
    setSaving(true);

    const result = await createCajaMovement({
      movement_date: arqueoDate,
      tipo: "AJUSTE",
      es_ingreso: String(diff > 0),
      amount: String(Math.abs(diff)),
      description: diff > 0 ? "Arqueo: sobrante en caja" : "Arqueo: faltante en caja",
    });

    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Ajuste de arqueo guardado");
    setContado("");
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`¿Eliminar el movimiento "${label}"? Solo es posible para movimientos manuales.`)) return;

    const result = await deleteCajaMovement(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Movimiento eliminado");
    startTransition(() => router.refresh());
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={Wallet}
          tileClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          label="Saldo en efectivo"
          value={formatCOP(saldoEfectivo)}
          valueClassName={saldoEfectivo >= 0 ? "text-emerald-600" : "text-red-600"}
          caption="Efectivo físico · todas las fechas"
          help={{
            what: "Plata física en caja (billetes y monedas), sumando todos los movimientos en efectivo registrados.",
            formula: "Σ ingresos − Σ egresos en efectivo (histórico)",
          }}
        />
        <KpiCard
          icon={CreditCard}
          tileClassName="bg-blue-500/10"
          iconClassName="text-blue-600"
          label="Saldo en transferencia"
          value={formatCOP(saldoTransferencia)}
          valueClassName={saldoTransferencia >= 0 ? "text-blue-600" : "text-red-600"}
          caption="Bancos · todas las fechas"
          help={{
            what: "Dinero que entra o sale por transferencia (bancos), sumando todos los movimientos de ese medio.",
            formula: "Σ ingresos − Σ egresos por transferencia (histórico)",
          }}
        />
        <KpiCard
          icon={Scale}
          label="Saldo total"
          value={formatCOP(saldo)}
          valueClassName={saldo >= 0 ? "text-emerald-600" : "text-red-600"}
          caption="Efectivo + transferencias"
          help={{
            what: "El saldo general del módulo: efectivo más transferencias, sumando todos los movimientos.",
            formula: "Saldo en efectivo + Saldo en transferencia",
          }}
        />
        <KpiCard
          icon={ArrowDownLeft}
          tileClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          label="Ingresos del período"
          value={formatCOP(ingresos)}
          valueClassName="text-emerald-600"
          caption={`${filtered.length} movimientos`}
          help={{
            what: "Entradas en el rango de fechas filtrado (ventas en efectivo, ventas por transferencia y abonos).",
            formula: "Σ movimientos tipo ingreso en el filtro",
          }}
        />
        <KpiCard
          icon={ArrowUpRight}
          tileClassName="bg-red-500/10"
          iconClassName="text-red-600"
          label="Egresos del período"
          value={formatCOP(-egresos)}
          valueClassName="text-red-600"
          caption="Compras, gastos y retiros"
          help={{
            what: "Salidas en el rango de fechas filtrado: compras de materia prima, gastos y retiros del dueño (efectivo o transferencia).",
            formula: "Σ movimientos tipo egreso en el filtro",
          }}
        />
        <KpiCard
          icon={CircleDollarSign}
          tileClassName="bg-blue-500/10"
          iconClassName="text-blue-600"
          label="Neto del período"
          value={formatCOP(ingresos + egresos)}
          valueClassName={ingresos + egresos >= 0 ? "text-blue-600" : "text-red-600"}
          caption={`${from} → ${to}`}
          help={{
            what: "Diferencia entre ingresos y egresos del período: lo que la caja ganó o perdió en esas fechas.",
            formula: "ingresos del período − egresos del período",
          }}
        />
      </div>

      {/* Arqueo del día */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Coins className="size-4 text-primary" />
            Arqueo de caja (efectivo)
          </CardTitle>
          <CardDescription>
            Efectivo esperado del día vs plata contada en el cajón. Las
            transferencias no cuentan aquí (se revisan contra el banco). Si hay
            diferencia, se crea un ajuste (sobrante/faltante) en el ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Día del arqueo</Label>
            <Input
              type="date"
              value={arqueoDate}
              onChange={(e) => setArqueoDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="rounded-lg bg-muted px-4 py-2">
            <p className="text-xs text-muted-foreground">Efectivo esperado</p>
            <p className={cn("text-lg font-bold", esperado >= 0 ? "text-emerald-600" : "text-red-600")}>
              {formatCOP(esperado)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Plata contada</Label>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              placeholder="0"
              className="w-40"
            />
          </div>
          {contado !== "" ? (
            <div className="rounded-lg bg-muted px-4 py-2">
              <p className="text-xs text-muted-foreground">Diferencia</p>
              <p className={cn("text-lg font-bold", diff === 0 ? "text-emerald-600" : diff > 0 ? "text-emerald-600" : "text-red-600")}>
                {diff === 0 ? "Cuadra" : `${formatCOP(Math.abs(diff))} ${diff > 0 ? "sobran" : "faltan"}`}
              </p>
            </div>
          ) : null}
          <Button
            onClick={handleAjuste}
            disabled={diff === 0 || saving}
            className="ml-auto"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
            Registrar ajuste
          </Button>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "Hoy", from: bogotaToday(), to: bogotaToday() },
              { label: "7 días", from: moveMonth(-6, bogotaToday()), to: bogotaToday() },
              { label: "Este mes", from: `${bogotaToday().slice(0, 8)}01`, to: bogotaToday() },
            ].map((r) => (
              <Button
                key={r.label}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setFrom(r.from);
                  setTo(r.to);
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Registrar movimiento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos de caja</CardTitle>
          <CardDescription>
            Las ventas entregadas (en efectivo o por transferencia) y las compras
            y gastos marcadas &ldquo;sale de caja&rdquo; se registran automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sin movimientos en este período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Fecha</th>
                    <th className="pb-2 pr-3 font-medium">Tipo</th>
                    <th className="pb-2 pr-3 font-medium">Detalle</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="pb-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const meta = TIPO_META[r.tipo];
                    const medio = METODO_META[r.metodo] ?? METODO_META.EFECTIVO;
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatDate(`${r.movement_date}T12:00:00Z`)}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className={cn("gap-1", meta.className)}>
                              {meta.label}
                            </Badge>
                            <Badge variant="secondary" className={cn("gap-1", medio.className)}>
                              {medio.label}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{r.description || r.fuente}</p>
                          <p className="text-xs text-muted-foreground">{r.fuente}</p>
                        </td>
                        <td className={cn("py-2 text-right font-semibold", r.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {r.amount >= 0 ? "+" : "−"}{formatCOP(Math.abs(Number(r.amount)))}
                        </td>
                        <td className="py-2 text-right">
                          {MANUAL_TIPOS.includes(r.tipo) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(r.id, r.description || r.fuente)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: movimiento manual */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimiento manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de movimiento</Label>
                <Select value={manTipo} onValueChange={(v) => setManTipo(v as typeof manTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INGRESO_EXTRA">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="size-3.5 text-emerald-600" />
                        Ingreso adicional
                      </span>
                    </SelectItem>
                    <SelectItem value="RETIRO">
                      <span className="flex items-center gap-2">
                        <TrendingDown className="size-3.5 text-red-600" />
                        Retiro (saca el dueño)
                      </span>
                    </SelectItem>
                    <SelectItem value="AJUSTE">
                      <span className="flex items-center gap-2">
                        <Coins className="size-3.5 text-blue-600" />
                        Ajuste del arqueo
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input name="movement_date" type="date" defaultValue={bogotaToday()} />
              </div>
            </div>

            {manTipo === "AJUSTE" ? (
              <div className="space-y-2">
                <Label>Dirección del ajuste</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={manIngreso ? "default" : "outline"}
                    size="sm"
                    onClick={() => setManIngreso(true)}
                  >
                    Sobrante (entra)
                  </Button>
                  <Button
                    type="button"
                    variant={!manIngreso ? "default" : "outline"}
                    size="sm"
                    onClick={() => setManIngreso(false)}
                  >
                    Faltante (sale)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  El ajuste siempre es en efectivo (nace de la plata contada en el cajón).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Medio</Label>
                <Select value={manMetodo} onValueChange={(v) => setManMetodo(v as CajaMetodo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Valor (COP) *{" "}
                <span className="text-muted-foreground">
                  ({manTipo === "INGRESO_EXTRA" || (manTipo === "AJUSTE" && manIngreso) ? "entra" : "sale"})
                </span>
              </Label>
              <Input name="amount" type="number" min={0.01} step="any" inputMode="decimal" placeholder="50000" required />
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Input
                name="description"
                required
                maxLength={200}
                placeholder="Ej: Abono de cliente, pago de fiado, precaución de cambio…"
              />
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Registrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}