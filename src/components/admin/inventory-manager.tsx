"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createInventoryItem, updateInventoryItem, registerMovement } from "@/features/inventory/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UNITS } from "@/lib/units";

interface ItemRow {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
}

interface MovementRow {
  id: string;
  inventory_item_id: string;
  movement_type: string;
  quantity: number;
  reference: string;
  created_at: string;
  item?: { name: string } | null;
}

export function InventoryManager({
  items,
  movements,
}: {
  items: ItemRow[];
  movements: MovementRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [itemDialog, setItemDialog] = useState(false);
  const [moveDialog, setMoveDialog] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreateItem() {
    setEditing(null);
    setError(null);
    setItemDialog(true);
  }

  function openEditItem(item: ItemRow) {
    setEditing(item);
    setError(null);
    setItemDialog(true);
  }

  async function handleItemSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      unit: String(fd.get("unit") ?? "unidad"),
      current_stock: String(fd.get("current_stock") ?? "0"),
      min_stock: String(fd.get("min_stock") ?? "0"),
    };

    const result = editing
      ? await updateInventoryItem(editing.id, payload)
      : await createInventoryItem(payload);

    setSaving(false);
    if (result.error) { setError(result.error); return; }

    toast.success(editing ? "Item actualizado" : "Item creado");
    setItemDialog(false);
    startTransition(() => router.refresh());
  }

  async function handleMoveSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      inventory_item_id: String(fd.get("inventory_item_id") ?? ""),
      movement_type: String(fd.get("movement_type") ?? "ENTRADA"),
      quantity: String(fd.get("quantity") ?? "0"),
      reference: String(fd.get("reference") ?? ""),
    };

    const result = await registerMovement(payload);
    setSaving(false);
    if (result.error) { setError(result.error); return; }

    toast.success("Movimiento registrado");
    setMoveDialog(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} insumos registrados ·{" "}
          {items.filter((i) => i.current_stock <= i.min_stock).length} con stock bajo
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setError(null); setMoveDialog(true); }}>
            <RefreshCw className="size-4" />
            Movimiento
          </Button>
          <Button onClick={openCreateItem}>
            <Plus className="size-4" />
            Nuevo insumo
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const low = item.current_stock <= item.min_stock;
          return (
            <Card key={item.id} className={low ? "border-amber-500/50" : ""}>
              <CardContent className="flex items-start justify-between py-4">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  {low ? (
                    <Badge variant="outline" className="gap-1 text-amber-600">
                      <AlertTriangle className="size-3" />
                      Bajo
                    </Badge>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-xs text-muted-foreground">Stock actual</span>
                <span className={`text-lg font-bold ${low ? "text-amber-600" : ""}`}>
                  {item.current_stock} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                </span>
              </div>
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-xs text-muted-foreground">Mínimo</span>
                <span className="text-sm text-muted-foreground">{item.min_stock} {item.unit}</span>
              </div>
            </Card>
          );
        })}

        {items.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            No hay insumos registrados. Crea el primero para empezar a controlar el stock.
          </div>
        ) : null}
      </div>

      {/* Historial de movimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-2">
              {movements.slice(0, 10).map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    {m.movement_type === "ENTRADA" ? (
                      <ArrowUpCircle className="size-4 text-emerald-600" />
                    ) : m.movement_type === "SALIDA" ? (
                      <ArrowDownCircle className="size-4 text-red-600" />
                    ) : (
                      <RefreshCw className="size-4 text-blue-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{m.item?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.reference || "Sin referencia"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${m.movement_type === "SALIDA" ? "text-red-600" : "text-emerald-600"}`}>
                      {m.movement_type === "SALIDA" ? "-" : "+"}{m.quantity}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{m.movement_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: crear/editar item */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input name="name" defaultValue={editing?.name ?? ""} required placeholder="Ej: Carne molida" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select name="unit" defaultValue={editing?.unit || "und"}>
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
                <Label>Stock mínimo</Label>
                <Input name="min_stock" type="number" min={0} step={0.1} defaultValue={editing?.min_stock ?? 5} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stock actual</Label>
              <Input name="current_stock" type="number" min={0} step={0.1} defaultValue={editing?.current_stock ?? 0} />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setItemDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: registrar movimiento */}
      <Dialog open={moveDialog} onOpenChange={setMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMoveSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Insumo *</Label>
              <Select name="inventory_item_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select name="movement_type" defaultValue="ENTRADA">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada (compra)</SelectItem>
                    <SelectItem value="SALIDA">Salida (uso/desperdicio)</SelectItem>
                    <SelectItem value="AJUSTE">Ajuste (conteo físico)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input name="quantity" type="number" min={0.1} step={0.1} required placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Textarea name="reference" rows={2} placeholder="Ej: Compra en Distribuidora XYZ" />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMoveDialog(false)}>Cancelar</Button>
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
