"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  HandCoins,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSocio,
  createSocioMovimiento,
  deleteSocio,
  deleteSocioMovimiento,
} from "@/features/caja/socios-actions";
import { formatCOP, formatDate } from "@/lib/format";
import { bogotaToday } from "@/lib/bogota";
import { BOLSILLO_LABEL } from "@/lib/caja-bolsillos";
import type { CajaBolsillo, CajaMetodo } from "@/types/db";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SocioRow {
  id: string;
  nombre: string;
}

export interface SocioMovRow {
  id: string;
  socio_id: string;
  tipo: "PRESTAMO" | "ABONO";
  movement_date: string;
  amount: number;
  metodo: CajaMetodo;
  bolsillo: CajaBolsillo;
  description: string;
  created_at: string;
}

type MovTipo = "PRESTAMO" | "ABONO";

const METODO_LABEL: Record<CajaMetodo, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

export function CajaSociosCard({
  socios,
  movimientos,
}: {
  socios: SocioRow[];
  movimientos: SocioMovRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showSaldados, setShowSaldados] = useState(false);

  const [socioOpen, setSocioOpen] = useState(false);

  const [movOpen, setMovOpen] = useState(false);
  const [movSocioId, setMovSocioId] = useState<string>("");
  const [movTipo, setMovTipo] = useState<MovTipo>("ABONO");
  const [movBolsillo, setMovBolsillo] = useState<CajaBolsillo>("GANANCIA");
  const [movMetodo, setMovMetodo] = useState<CajaMetodo>("EFECTIVO");

  // Resumen por socio: prestado, abonado, debe y último abono.
  const resumen = useMemo(() => {
    return socios.map((s) => {
      const movs = movimientos.filter((m) => m.socio_id === s.id);
      const prestado = movs
        .filter((m) => m.tipo === "PRESTAMO")
        .reduce((acc, m) => acc + m.amount, 0);
      const abonado = movs
        .filter((m) => m.tipo === "ABONO")
        .reduce((acc, m) => acc + m.amount, 0);
      const ultimoAbono = movs
        .filter((m) => m.tipo === "ABONO")
        .reduce<string | null>(
          (max, m) => (max === null || m.movement_date > max ? m.movement_date : max),
          null
        );
      return {
        socio: s,
        movs,
        prestado,
        abonado,
        debe: prestado - abonado,
        ultimoAbono,
      };
    });
  }, [socios, movimientos]);

  const totalDeuda = resumen.reduce((s, r) => s + Math.max(r.debe, 0), 0);
  const visibles = resumen.filter((r) => showSaldados || r.debe > 0 || r.movs.length === 0);
  const ocultos = resumen.length - visibles.length;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openMov(socioId: string, tipo: MovTipo) {
    setMovSocioId(socioId);
    setMovTipo(tipo);
    setError(null);
    setMovOpen(true);
  }

  async function handleCreateSocio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await createSocio({ nombre: String(fd.get("nombre") ?? "") });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success("Socio agregado");
    setSocioOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleCreateMov(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await createSocioMovimiento({
      socio_id: movSocioId,
      tipo: movTipo,
      movement_date: String(fd.get("movement_date") ?? bogotaToday()),
      bolsillo: movBolsillo,
      metodo: movMetodo,
      amount: String(fd.get("amount") ?? ""),
      description: String(fd.get("description") ?? ""),
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(movTipo === "PRESTAMO" ? "Préstamo registrado" : "Abono registrado");
    setMovOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleDeleteMov(id: string) {
    if (!confirm("¿Eliminar este movimiento? También se corrige el saldo de la base en la caja.")) return;

    const result = await deleteSocioMovimiento(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Movimiento eliminado");
    startTransition(() => router.refresh());
  }

  async function handleDeleteSocio(id: string, nombre: string) {
    if (!confirm(`¿Eliminar al socio "${nombre}"?`)) return;

    const result = await deleteSocio(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Socio eliminado");
    startTransition(() => router.refresh());
  }

  const movSocio = socios.find((s) => s.id === movSocioId);
  const movDeuda = resumen.find((r) => r.socio.id === movSocioId)?.debe ?? 0;
  const esPrestamo = movTipo === "PRESTAMO";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="size-4 text-primary" />
                Deuda de socios
              </CardTitle>
              <CardDescription>
                Lo que cada socio le debe a la caja. Los préstamos salen de la
                base que elijas y los abonos entran a la base que elijas; ambos
                quedan reflejados en los movimientos de caja.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setError(null);
                setSocioOpen(true);
              }}
            >
              <UserPlus className="size-4" />
              Socio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Total que deben los socios</p>
            <p className={cn("text-xl font-bold", totalDeuda > 0 ? "text-red-600" : "text-emerald-600")}>
              {formatCOP(totalDeuda)}
            </p>
          </div>

          {socios.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay socios. Agrega uno con el botón &ldquo;Socio&rdquo;.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Socio</th>
                    <th className="pb-2 pr-3 text-right font-medium">Prestado</th>
                    <th className="pb-2 pr-3 text-right font-medium">Abonado</th>
                    <th className="pb-2 pr-3 text-right font-medium">Debe</th>
                    <th className="pb-2 pr-3 font-medium">Último abono</th>
                    <th className="pb-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => {
                    const open = expanded.has(r.socio.id);
                    const saldado = r.movs.length > 0 && r.debe <= 0;
                    return (
                      <Fragment key={r.socio.id}>
                        <tr className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              onClick={() => toggle(r.socio.id)}
                              className="flex items-center gap-1.5 font-medium hover:text-primary"
                              aria-expanded={open}
                            >
                              {open ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                              {r.socio.nombre}
                            </button>
                          </td>
                          <td className="py-2 pr-3 text-right">{formatCOP(r.prestado)}</td>
                          <td className="py-2 pr-3 text-right text-emerald-600">{formatCOP(r.abonado)}</td>
                          <td className="py-2 pr-3 text-right font-semibold">
                            {saldado ? (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                                Saldado
                              </Badge>
                            ) : (
                              <span className={r.debe > 0 ? "text-red-600" : undefined}>
                                {formatCOP(r.debe)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                            {r.ultimoAbono ? formatDate(`${r.ultimoAbono}T12:00:00Z`) : "—"}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={r.debe <= 0}
                                onClick={() => openMov(r.socio.id, "ABONO")}
                              >
                                Abonar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openMov(r.socio.id, "PRESTAMO")}
                              >
                                Prestar
                              </Button>
                              {r.movs.length === 0 ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteSocio(r.socio.id, r.socio.nombre)}
                                  aria-label={`Eliminar a ${r.socio.nombre}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-b bg-muted/30">
                            <td colSpan={6} className="px-3 py-3">
                              {r.movs.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Sin movimientos.</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {r.movs.map((m) => (
                                    <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                      <span className="w-24 whitespace-nowrap text-muted-foreground">
                                        {formatDate(`${m.movement_date}T12:00:00Z`)}
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className={
                                          m.tipo === "ABONO"
                                            ? "bg-emerald-500/10 text-emerald-600"
                                            : "bg-orange-500/10 text-orange-600"
                                        }
                                      >
                                        {m.tipo === "ABONO" ? "Abono" : "Préstamo"}
                                      </Badge>
                                      <span className="font-semibold">{formatCOP(m.amount)}</span>
                                      <span className="text-muted-foreground">
                                        {METODO_LABEL[m.metodo]} ·{" "}
                                        {m.tipo === "ABONO" ? "entró a" : "salió de"}{" "}
                                        {BOLSILLO_LABEL[m.bolsillo]}
                                      </span>
                                      {m.description ? <span>{m.description}</span> : null}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto h-6 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteMov(m.id)}
                                        aria-label="Eliminar movimiento"
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {ocultos > 0 || showSaldados ? (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowSaldados((v) => !v)}>
                {showSaldados ? "Ocultar saldados" : `Ver saldados (${ocultos})`}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Diálogo: nuevo socio */}
      <Dialog open={socioOpen} onOpenChange={setSocioOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar socio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSocio} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input name="nombre" required minLength={2} maxLength={80} placeholder="Ej: Carlos" />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSocioOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Agregar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: préstamo / abono */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {esPrestamo ? "Prestar a" : "Abono de"} {movSocio?.nombre ?? "socio"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMov} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Hoy debe{" "}
              <span className="font-semibold text-foreground">{formatCOP(Math.max(movDeuda, 0))}</span>
              .
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{esPrestamo ? "Sale de la base" : "Entra a la base"}</Label>
                <Select value={movBolsillo} onValueChange={(v) => setMovBolsillo(v as CajaBolsillo)}>
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
                <Label>Medio</Label>
                <Select value={movMetodo} onValueChange={(v) => setMovMetodo(v as CajaMetodo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (COP) *</Label>
                <Input
                  name="amount"
                  type="number"
                  min={0.01}
                  step="any"
                  inputMode="decimal"
                  placeholder="50000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input name="movement_date" type="date" defaultValue={bogotaToday()} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input
                name="description"
                maxLength={200}
                placeholder={esPrestamo ? "Ej: Para pagar la cuota del local" : "Ej: Abono quincena"}
              />
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMovOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {esPrestamo ? "Registrar préstamo" : "Registrar abono"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
