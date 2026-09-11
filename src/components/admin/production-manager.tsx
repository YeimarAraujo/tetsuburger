"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, PackagePlus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createProductionRecord, createItemFromPurchase } from "@/features/production/actions";
import { findInventoryItemByBarcode } from "@/features/inventory/actions";
import { formatCOP, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/admin/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarcodeCameraButton } from "@/components/admin/barcode-camera";
import { UNITS } from "@/lib/units";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  barcode: string | null;
}

interface ProdRow {
  id: string;
  record_date: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes: string;
  item?: { name: string } | null;
}

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function ProductionManager({
  records,
  inventoryItems,
}: {
  records: ProdRow[];
  inventoryItems: InventoryItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newItemDialog, setNewItemDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [items, setItems] = useState<InventoryItem[]>(inventoryItems);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newItemBarcode, setNewItemBarcode] = useState("");

  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);

  async function doScan(codeOverride?: string) {
    const code = (codeOverride ?? barcodeInput).trim();
    if (!code) return;
    setScanning(true);
    setScanMsg(null);
    const item = await findInventoryItemByBarcode(code);
    setScanning(false);
    if (item) {
      setSelectedItem(item.id);
      setScanMsg({ ok: true, text: `Encontrado: ${item.name}. Solo completa cantidad, costo y describe.` });
    } else {
      setNewItemBarcode(code);
      setNewItemDialog(true);
      setScanMsg({ ok: false, text: "Ese código no estaba en inventario: crea el insumo para guardarlo." });
    }
  }

  async function handleRecordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      record_date: String(fd.get("record_date") ?? bogotaToday()),
      inventory_item_id: selectedItem || null,
      description: String(fd.get("description") ?? ""),
      quantity: String(fd.get("quantity") ?? "1"),
      unit: String(fd.get("unit") ?? "unidad"),
      unit_cost: String(fd.get("unit_cost") ?? "0"),
      notes: String(fd.get("notes") ?? ""),
      from_caja: String(fd.get("from_caja") === "on"),
      metodo: String(fd.get("metodo") ?? "EFECTIVO"),
    };

    const result = await createProductionRecord(payload);
    setSaving(false);
    if (result.error) { setError(result.error); return; }

    toast.success(selectedItem ? "Compra registrada e inventario actualizado" : "Compra registrada");
    setDialogOpen(false);
    setSelectedItem("");
    setQuantity("");
    setUnitCost("");
    startTransition(() => router.refresh());
  }

  async function handleNewItemSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      unit: String(fd.get("unit") ?? "unidad"),
      barcode: String(fd.get("barcode") ?? ""),
    };

    const result = await createItemFromPurchase(payload);
    setSaving(false);
    if (result.error) { setError(result.error); return; }

    if (result.id) {
      setItems((prev) => [...prev, { id: result.id!, name: payload.name, unit: payload.unit, barcode: payload.barcode || null }]);
      setSelectedItem(result.id);
    }

    toast.success("Insumo creado");
    setNewItemDialog(false);
    setBarcodeInput("");
    setScanMsg(null);
  }

  // Agrupar por día
  const grouped = records.reduce((acc, r) => {
    const day = r.record_date;
    if (!acc[day]) acc[day] = [];
    acc[day].push(r);
    return acc;
  }, {} as Record<string, ProdRow[]>);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {records.length} compras · el inventario se actualiza automáticamente
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Registrar compra
        </Button>
      </div>

      {/* Resumen del día de hoy */}
      {records.filter((r) => r.record_date === bogotaToday()).length > 0 ? (
        <KpiCard
          icon={PackagePlus}
          tileClassName="bg-primary/10"
          iconClassName="text-primary"
          label="Compras de hoy"
          value={formatCOP(
            records
              .filter((r) => r.record_date === bogotaToday())
              .reduce((s, r) => s + Number(r.total_cost), 0)
          )}
          caption={`${records.filter((r) => r.record_date === bogotaToday()).length} registros`}
          help={{
            what: "Total invertido hoy en materia prima registrado en Producción. El stock se actualiza automáticamente.",
            formula: "Σ total_cost de las compras del día",
          }}
        />
      ) : null}

      {/* Lista por día */}
      {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, dayRecords]) => {
        const dayTotal = dayRecords.reduce((s, r) => s + Number(r.total_cost), 0);
        return (
          <div key={date} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{formatDate(`${date}T12:00:00Z`)}</h3>
              <Badge variant="secondary">{formatCOP(dayTotal)}</Badge>
            </div>
            <Card>
              <CardContent className="overflow-x-auto py-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Insumo</th>
                      <th className="pb-2 pr-3 font-medium">Descripción</th>
                      <th className="pb-2 pr-3 text-right font-medium">Cant.</th>
                      <th className="pb-2 pr-3 text-right font-medium">Costo/ud</th>
                      <th className="pb-2 pr-3 text-right font-medium">Total</th>
                      <th className="hidden pb-2 font-medium md:table-cell">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRecords.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          {r.item?.name ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <PackagePlus className="size-3" />
                              {r.item.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-medium">{r.description}</td>
                        <td className="py-2 pr-3 text-right">{r.quantity} {r.unit}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">
                          {Number(r.unit_cost) > 0 ? formatCOP(Number(r.unit_cost)) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold">
                          {formatCOP(Number(r.total_cost))}
                        </td>
                        <td className="hidden max-w-[180px] truncate py-2 text-muted-foreground md:table-cell">
                          {r.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        );
      })}

      {records.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay compras registradas. Registra la materia prima que compraste hoy.
          </CardContent>
        </Card>
      )}

      {/* Diálogo: registrar compra */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar compra del día</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Código de barras del empaque</Label>
              <div className="flex gap-2">
                <Input
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doScan(); } }}
                  placeholder="Escanea con el lector o pega el código…"
                  className="font-mono"
                  autoFocus
                />
                <Button type="button" variant="outline" onClick={() => doScan()} disabled={scanning}>
                  {scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Buscar
                </Button>
                <BarcodeCameraButton onDetected={(code) => doScan(code)} />
              </div>
              {scanMsg ? (
                <p className={`text-xs ${scanMsg.ok ? "text-emerald-600" : "text-amber-600"}`}>
                  {scanMsg.text}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Si el insumo ya existe en inventario se preselecciona abajo; si no, se crea con ese código.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input name="record_date" type="date" defaultValue={bogotaToday()} />
              </div>
              <div className="space-y-2">
                <Label>Insumo del inventario</Label>
                <div className="flex gap-2">
                  <Select value={selectedItem} onValueChange={setSelectedItem}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                          {i.barcode ? ` · ${i.barcode}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => { setNewItemBarcode(""); setNewItemDialog(true); }}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                {selectedItem && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <CircleCheck className="size-3.5" />
                    El stock se actualizará automáticamente
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción de la compra *</Label>
              <Input name="description" required placeholder="Ej: Carne molida premium" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input name="quantity" type="number" min={0.1} step={0.1} required defaultValue={1} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select name="unit" defaultValue="und">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Costo unitario (COP)</Label>
                <Input name="unit_cost" type="number" min={0} step="0.01" inputMode="decimal" placeholder="3250" onChange={(e) => setUnitCost(e.target.value)} />
              </div>
            </div>

            {totalCost > 0 && (
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Costo total</p>
                <p className="text-xl font-bold text-primary">{formatCOP(totalCost)}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="from_caja" className="size-4" />
                ¿Esta compra salió de la caja?
              </label>
              <p className="text-xs text-muted-foreground">
                Marca si salió de la caja: se descuenta del saldo del módulo
                Caja y Pagos.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Medio de pago (si sale de caja)</Label>
              <Select name="metodo" defaultValue="EFECTIVO">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea name="notes" rows={2} placeholder="Dónde compraste, etc." />
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Registrar compra
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: crear insumo rápido */}
      <Dialog open={newItemDialog} onOpenChange={setNewItemDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear insumo nuevo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNewItemSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del insumo *</Label>
              <Input name="name" required placeholder="Ej: Carne molida" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select name="unit" defaultValue="und">
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Código de barras</Label>
              <Input
                name="barcode"
                defaultValue={newItemBarcode}
                placeholder="Escanea o escribe (opcional)"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Quedará guardado para que la próxima compra se identifique al escanear.
              </p>
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewItemDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Crear insumo
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
