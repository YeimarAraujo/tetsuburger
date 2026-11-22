"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, CircleDollarSign, Coins, CreditCard, Landmark, Loader2, PiggyBank, Plus, Scale, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { createCajaMovement, createCajaTransfer, deleteCajaMovement } from "@/features/caja/actions";
import { formatCOP, formatDate } from "@/lib/format";
import { bogotaToday } from "@/lib/bogota";
import {
  BOLSILLOS,
  BOLSILLO_LABEL,
  saldoBolsillo,
  type BolsilloSaldo,
} from "@/lib/caja-bolsillos";
import type { CajaBolsillo, CajaMetodo, CajaTipo } from "@/types/db";
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
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import {
  CajaSociosCard,
  type SocioMovRow,
  type SocioRow,
} from "@/components/admin/caja-socios-card";

export interface CajaRow {
  id: string;
  movement_date: string;
  tipo: CajaTipo;
  metodo: CajaMetodo;
  bolsillo: CajaBolsillo;
  amount: number;
  description: string;
  fuente: string;
  created_at: string;
}

const MANUAL_TIPOS: CajaTipo[] = ["INGRESO_EXTRA", "RETIRO", "AJUSTE", "TRASLADO"];

const BOLSILLO_META: Record<CajaBolsillo, { label: string; className: string }> = {
  COMPRAS: { label: "Compras", className: "bg-amber-500/10 text-amber-700" },
  GANANCIA: { label: "Ganancia", className: "bg-violet-500/10 text-violet-600" },
};

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
  TRASLADO: { label: "Traslado", className: "bg-slate-500/10 text-slate-600" },
};

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // lunes = 0, domingo = 6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function lastMovementDate(rows: CajaRow[], cutoff: string): string | null {
  let max: string | null = null;
  for (const r of rows) {
    if (r.movement_date <= cutoff && (max === null || r.movement_date > max)) {
      max = r.movement_date;
    }
  }
  return max;
}

/** Tarjeta de una base: saldo en efectivo, transferencia y total. */
function BaseCard({
  bolsillo,
  saldo,
  onTransfer,
}: {
  bolsillo: CajaBolsillo;
  saldo: BolsilloSaldo;
  onTransfer: () => void;
}) {
  const meta = BOLSILLO_META[bolsillo];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="size-4 text-primary" />
          {BOLSILLO_LABEL[bolsillo]}
          <Badge variant="secondary" className={cn("ml-1", meta.className)}>
            {bolsillo === "COMPRAS" ? "Reposición de insumos" : "Lo que ganas"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {bolsillo === "COMPRAS"
            ? "Recibe el costo de cada venta entregada. De aquí salen las compras de materia prima."
            : "Es lo que se acumula aparte de la Base de Compras: recibe el margen de cada venta entregada (venta − costo). De aquí salen gastos y retiros."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="size-3.5" /> Efectivo
            </p>
            <p className={cn("text-lg font-bold", saldo.efectivo >= 0 ? "text-emerald-600" : "text-red-600")}>
              {formatCOP(saldo.efectivo)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="size-3.5" /> Transferencia
            </p>
            <p className={cn("text-lg font-bold", saldo.transferencia >= 0 ? "text-blue-600" : "text-red-600")}>
              {formatCOP(saldo.transferencia)}
            </p>
          </div>
          <div className="rounded-lg bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Scale className="size-3.5" /> Total
            </p>
            <p className={cn("text-lg font-bold", saldo.total >= 0 ? "text-foreground" : "text-red-600")}>
              {formatCOP(saldo.total)}
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button type="button" size="sm" variant="outline" onClick={onTransfer}>
            <ArrowLeftRight className="size-4" />
            Trasladar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CajaManager({
  rows,
  socios,
  socioMovs,
}: {
  rows: CajaRow[];
  socios: SocioRow[];
  socioMovs: SocioMovRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(() => `${bogotaToday().slice(0, 8)}01`);
  const [to, setTo] = useState(bogotaToday());

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- usado por el bloque "Arqueo de caja" (comentado)
  const [arqueoDate, setArqueoDate] = useState(bogotaToday());
  const [contado, setContado] = useState("");
  const [manTipo, setManTipo] = useState<"INGRESO_EXTRA" | "RETIRO" | "AJUSTE">("INGRESO_EXTRA");
  const [manIngreso, setManIngreso] = useState(false);
  const [manMetodo, setManMetodo] = useState<CajaMetodo>("EFECTIVO");
  const [manBolsillo, setManBolsillo] = useState<CajaBolsillo>("GANANCIA");

  const [transferOpen, setTransferOpen] = useState(false);
  const [trDesde, setTrDesde] = useState<CajaBolsillo>("GANANCIA");
  const [trMetodo, setTrMetodo] = useState<CajaMetodo>("EFECTIVO");

  const [bolsilloFilter, setBolsilloFilter] = useState<"TODAS" | CajaBolsillo>("TODAS");
  const [corteDate, setCorteDate] = useState(() => lastMovementDate(rows, bogotaToday()) ?? bogotaToday());
  const [weekIdx, setWeekIdx] = useState(0);

  // Saldo de cada base = suma de sus movimientos (efectivo y transferencia).
  const saldos = useMemo(
    () => ({
      COMPRAS: saldoBolsillo(rows, "COMPRAS"),
      GANANCIA: saldoBolsillo(rows, "GANANCIA"),
    }),
    [rows]
  );
  const saldoTotal = saldos.COMPRAS.total + saldos.GANANCIA.total;

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.movement_date >= from &&
          r.movement_date <= to &&
          (bolsilloFilter === "TODAS" || r.bolsillo === bolsilloFilter)
      ),
    [rows, from, to, bolsilloFilter]
  );
  const pager = usePagination(filtered);
  // Los traslados entre bases no son ingresos ni egresos reales: se excluyen.
  const reales = filtered.filter((r) => r.tipo !== "TRASLADO");
  const ingresos = reales.filter((r) => r.amount > 0).reduce((s, r) => s + Number(r.amount), 0);
  const egresos = reales.filter((r) => r.amount < 0).reduce((s, r) => s + Number(r.amount), 0);

  const dayRows = useMemo(
    () => rows.filter((r) => r.movement_date === arqueoDate),
    [rows, arqueoDate]
  );
  // El arqueo compara contra la plata física del cajón: solo efectivo.
  const esperado = dayRows
    .filter((r) => r.metodo === "EFECTIVO")
    .reduce((s, r) => s + Number(r.amount), 0);
  const diff = (Number(contado) || 0) - esperado;

  // Saldo acumulado hasta la fecha de corte (día puntual).
  const corteData = useMemo(() => {
    const ultimoDia = lastMovementDate(rows, corteDate) ?? corteDate;
    const compras = saldoBolsillo(rows, "COMPRAS", ultimoDia);
    const ganancia = saldoBolsillo(rows, "GANANCIA", ultimoDia);
    return {
      corte: corteDate,
      ultimoDia,
      saldos: { COMPRAS: compras, GANANCIA: ganancia } as Record<CajaBolsillo, BolsilloSaldo>,
      total: compras.total + ganancia.total,
    };
  }, [rows, corteDate]);

  // Ganancia por semana: comparación del saldo final de cada semana.
  const weeks = useMemo(() => {
    const startThis = startOfWeekMonday(bogotaToday());
    return [
      { label: "Esta semana", start: startThis },
      { label: "Semana pasada", start: addDays(startThis, -7) },
      { label: "Hace 2 semanas", start: addDays(startThis, -14) },
    ];
  }, []);

  const weekData = useMemo(() => {
    const week = weeks[weekIdx];
    const weekEnd = addDays(week.start, 6);
    const ultimo = lastMovementDate(rows, weekEnd);
    const finSemana = ultimo !== null && ultimo >= week.start ? ultimo : null;
    const cutoffPrevio = addDays(week.start, -1);
    const gananciaFin = saldoBolsillo(rows, "GANANCIA", weekEnd);
    const gananciaPrev = saldoBolsillo(rows, "GANANCIA", cutoffPrevio);
    const comprasFin = saldoBolsillo(rows, "COMPRAS", weekEnd);
    const comprasPrev = saldoBolsillo(rows, "COMPRAS", cutoffPrevio);
    return {
      start: week.start,
      end: weekEnd,
      finSemana,
      gananciaFin,
      gananciaPrev,
      gananciaSemana: gananciaFin.total - gananciaPrev.total,
      comprasSemana: comprasFin.total - comprasPrev.total,
    };
  }, [rows, weekIdx, weeks]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      movement_date: String(fd.get("movement_date") ?? bogotaToday()),
      tipo: manTipo,
      bolsillo: manBolsillo,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- usado por el bloque "Arqueo de caja" (comentado)
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

  function openTransfer(desde: CajaBolsillo) {
    setTrDesde(desde);
    setError(null);
    setTransferOpen(true);
  }

  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await createCajaTransfer({
      movement_date: String(fd.get("movement_date") ?? bogotaToday()),
      desde: trDesde,
      metodo: trMetodo,
      amount: String(fd.get("amount") ?? ""),
      description: String(fd.get("description") ?? ""),
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success("Traslado registrado");
    setTransferOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`¿Eliminar el movimiento "${label}"? Solo es posible para movimientos manuales y traslados (el traslado se elimina completo).`)) return;

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
      {/* Las dos bases: saldo (efectivo / transferencia) y monto definido */}
      <div className="grid gap-4 lg:grid-cols-2">
        {BOLSILLOS.map((b) => (
          <BaseCard
            key={b}
            bolsillo={b}
            saldo={saldos[b]}
            onTransfer={() => openTransfer(b)}
          />
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Scale}
          label="Saldo total"
          value={formatCOP(saldoTotal)}
          valueClassName={saldoTotal >= 0 ? "text-emerald-600" : "text-red-600"}
          caption="Base de Compras + Base de Ganancia"
          help={{
            what: "El saldo general de la caja: lo que hay en las dos bases juntas (efectivo y transferencias).",
            formula: "Saldo Base de Compras + Saldo Base de Ganancia",
          }}
        />
        <KpiCard
          icon={ArrowDownLeft}
          tileClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          label="Ingresos del período"
          value={formatCOP(ingresos)}
          valueClassName="text-emerald-600"
          caption={`${reales.length} movimientos`}
          help={{
            what: "Entradas en el rango de fechas y la base filtrados (ventas, abonos). Los traslados entre bases no cuentan.",
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
            what: "Salidas en el rango de fechas y la base filtrados: compras de materia prima, gastos y retiros del dueño. Los traslados entre bases no cuentan.",
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
      {/* <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
      </Card> */}

      {/* Saldo a una fecha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            Saldo a una fecha
          </CardTitle>
          <CardDescription>
            Cuánto hay acumulado en cada base (efectivo + transferencia) hasta el
            día de corte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Fecha de corte</Label>
              <Input
                type="date"
                value={corteDate}
                onChange={(e) => setCorteDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setCorteDate(bogotaToday())}>Hoy</Button>
              <Button variant="outline" size="sm" onClick={() => setCorteDate(addDays(bogotaToday(), -1))}>Ayer</Button>
              <Button variant="outline" size="sm" onClick={() => setCorteDate(lastMovementDate(rows, bogotaToday()) ?? bogotaToday())}>
                Últ. día de trabajo
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCorteDate(lastMovementDate(rows, addDays(weeks[1].start, 6)) ?? addDays(weeks[1].start, 6))}>
                Fin semana pasada
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Último día con movimientos ≤ al corte:{" "}
            <span className="font-semibold text-foreground">
              {formatDate(`${corteData.ultimoDia}T12:00:00Z`)}
            </span>
          </p>
          {BOLSILLOS.map((b) => (
            <div key={b} className="space-y-2">
              <p className="text-sm font-semibold">{BOLSILLO_LABEL[b]}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCOP(corteData.saldos[b].efectivo)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Transferencia</p>
                  <p className="text-lg font-bold text-blue-600">{formatCOP(corteData.saldos[b].transferencia)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCOP(corteData.saldos[b].total)}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Saldo total (ambas bases)</p>
            <p className={`text-xl font-bold ${corteData.total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCOP(corteData.total)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ganancia por semana */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="size-4 text-primary" />
            Ganancia por semana
          </CardTitle>
          <CardDescription>
            Cuánto creció la Base de Ganancia en la semana (saldo final vs saldo
            de la semana anterior) y cómo se movió la Base de Compras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {weeks.map((w, i) => (
              <Button
                key={w.label}
                variant={weekIdx === i ? "default" : "outline"}
                size="sm"
                onClick={() => setWeekIdx(i)}
              >
                {w.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Semana {formatDate(`${weekData.start}T12:00:00Z`)} → {formatDate(`${weekData.end}T12:00:00Z`)} ·{" "}
            {weekData.finSemana ? `último día trabajado: ${formatDate(`${weekData.finSemana}T12:00:00Z`)}` : "sin movimientos en la semana"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ganancia · saldo fin de semana</p>
              <p className="text-lg font-bold">{formatCOP(weekData.gananciaFin.total)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ganancia · saldo fin semana anterior</p>
              <p className="text-lg font-bold text-muted-foreground">{formatCOP(weekData.gananciaPrev.total)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ganancia de la semana</p>
              <p className={`text-lg font-bold ${weekData.gananciaSemana >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCOP(weekData.gananciaSemana)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Variación de Compras en la semana</p>
              <p className={`text-lg font-bold ${weekData.comprasSemana >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCOP(weekData.comprasSemana)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deuda de socios */}
      <CajaSociosCard socios={socios} movimientos={socioMovs} />

      {/* Filtros */}
      <DateRangeFilter
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
        pending={isPending}
      >
        <Select value={bolsilloFilter} onValueChange={(v) => setBolsilloFilter(v as "TODAS" | CajaBolsillo)}>
          <SelectTrigger className="w-44" aria-label="Filtrar por base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Ambas bases</SelectItem>
            <SelectItem value="COMPRAS">Base de Compras</SelectItem>
            <SelectItem value="GANANCIA">Base de Ganancia</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => openTransfer("GANANCIA")}>
          <ArrowLeftRight className="size-4" />
          Trasladar
        </Button>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Registrar movimiento
        </Button>
      </DateRangeFilter>

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
                  {pager.visible.map((r) => {
                    const meta = TIPO_META[r.tipo];
                    const medio = METODO_META[r.metodo] ?? METODO_META.EFECTIVO;
                    const baseMeta = BOLSILLO_META[r.bolsillo] ?? BOLSILLO_META.GANANCIA;
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
                            <Badge variant="secondary" className={cn("gap-1", baseMeta.className)}>
                              {baseMeta.label}
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
              <TablePagination pager={pager} />
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

            <div className={manTipo === "AJUSTE" ? "space-y-4" : "grid grid-cols-2 gap-4"}>
              <div className="space-y-2">
                <Label>
                  Base{" "}
                  <span className="text-muted-foreground">
                    ({manTipo === "INGRESO_EXTRA" || (manTipo === "AJUSTE" && manIngreso) ? "a la que entra" : "de la que sale"})
                  </span>
                </Label>
                <Select value={manBolsillo} onValueChange={(v) => setManBolsillo(v as CajaBolsillo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GANANCIA">Base de Ganancia</SelectItem>
                    <SelectItem value="COMPRAS">Base de Compras</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {manTipo !== "AJUSTE" ? (
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
              ) : null}
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
            ) : null}

            <div className="grid grid-cols-[2fr_3fr] gap-4">
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
                  placeholder="Ej: Abono de cliente, pago de fiado…"
                />
              </div>
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

      {/* Diálogo: traslado entre bases */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trasladar plata entre bases</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sale de</Label>
                <Select value={trDesde} onValueChange={(v) => setTrDesde(v as CajaBolsillo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GANANCIA">Base de Ganancia</SelectItem>
                    <SelectItem value="COMPRAS">Base de Compras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entra a</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                  {BOLSILLO_LABEL[trDesde === "COMPRAS" ? "GANANCIA" : "COMPRAS"]}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Medio</Label>
                <Select value={trMetodo} onValueChange={(v) => setTrMetodo(v as CajaMetodo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input name="movement_date" type="date" defaultValue={bogotaToday()} />
              </div>
            </div>

            <div className="grid grid-cols-[2fr_3fr] gap-4">
              <div className="space-y-2">
                <Label>Valor (COP) *</Label>
                <Input name="amount" type="number" min={0.01} step="any" inputMode="decimal" placeholder="50000" required />
              </div>

              <div className="space-y-2">
                <Label>Nota (opcional)</Label>
                <Input name="description" maxLength={200} placeholder="Ej: Completar compra de carne" />
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Trasladar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}