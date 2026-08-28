"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Addon } from "@/types/db";
import {
  createAddon,
  setAddonActive,
  updateAddon,
} from "@/features/products/actions";
import {
  setAddonConsumption,
  deleteAddonConsumption,
} from "@/features/consumption/actions";
import { formatCOP } from "@/lib/format";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface AddonConsumptionRow {
  id: string;
  addon_id: string;
  inventory_item_id: string;
  quantity: number;
  item?: { name: string; unit: string } | null;
}

export function AddonManager({
  initial,
  inventoryItems,
  consumptions,
}: {
  initial: Addon[];
  inventoryItems: { id: string; name: string; unit: string }[];
  consumptions: AddonConsumptionRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consumptionAddon, setConsumptionAddon] = useState<Addon | null>(null);

  const addonConsumptions = new Map<string, AddonConsumptionRow[]>();
  for (const c of consumptions) {
    const list = addonConsumptions.get(c.addon_id) ?? [];
    list.push(c);
    addonConsumptions.set(c.addon_id, list);
  }

  function openCreate() {
    setEditing(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(addon: Addon) {
    setEditing(addon);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = editing
      ? await updateAddon(editing.id, formData)
      : await createAddon(formData);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(editing ? "Adicional actualizado" : "Adicional creado");
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleToggle(addon: Addon, value: boolean) {
    const result = await setAddonActive(addon.id, value);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(value ? "Adicional activado" : "Adicional desactivado");
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Adicionales</CardTitle>
            <CardDescription>
              Extras globales (+queso, +tocineta…) que luego asocias a cada
              producto. El precio queda guardado en el pedido histórico.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nuevo adicional
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Nombre</th>
                  <th className="pb-2 pr-2 font-medium">Precio</th>
                  <th className="pb-2 pr-2 font-medium">Activo</th>
                  <th className="pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {initial.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-muted-foreground">
                      No hay adicionales todavía.
                    </td>
                  </tr>
                ) : (
                  initial.map((addon) => (
                    <tr key={addon.id} className="border-b last:border-0">
                      <td className="py-3 pr-2 font-medium">{addon.name}</td>
                      <td className="py-3 pr-2">+{formatCOP(addon.price)}</td>
                      <td className="py-3 pr-2">
                        <Switch
                          checked={addon.is_active}
                          disabled={isPending}
                          onCheckedChange={(checked) => handleToggle(addon, checked)}
                          aria-label={`Activar ${addon.name}`}
                        />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setConsumptionAddon(addon)}>
                            Consumos
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(addon)}>
                            <Pencil className="size-3.5" />
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar adicional" : "Nuevo adicional"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addon-name">Nombre *</Label>
              <Input
                id="addon-name"
                name="name"
                defaultValue={editing?.name ?? ""}
                placeholder="Ej: Queso extra"
                required
                maxLength={60}
              />
            </div>

            <div className="grid grid-cols-2 items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="addon-price">Precio (COP) *</Label>
                <Input
                  id="addon-price"
                  name="price"
                  type="number"
                  min={0}
                  step={100}
                  defaultValue={editing?.price ?? ""}
                  placeholder="3000"
                  required
                />
              </div>
              <input type="hidden" name="is_active" value={editing ? (editing.is_active ? "on" : "") : "on"} />
              <div className="flex items-center justify-between gap-2 pb-1.5">
                <Label htmlFor="addon-active" className="text-sm">Activo</Label>
                <span className="text-xs text-muted-foreground">
                  {editing ? (editing.is_active ? "Sí" : "No") : "Sí"}
                </span>
              </div>
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
                  "Crear adicional"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Consumos de insumos por adición */}
      <AddonConsumptionDialog
        open={Boolean(consumptionAddon)}
        onOpenChange={(o) => { if (!o) setConsumptionAddon(null); }}
        addon={consumptionAddon}
        inventoryItems={inventoryItems}
        consumptions={
          consumptionAddon ? addonConsumptions.get(consumptionAddon.id) ?? [] : []
        }
      />
    </>
  );
}

/* --------------------------- Diálogo de consumos --------------------------- */

function AddonConsumptionDialog({
  open,
  onOpenChange,
  addon,
  inventoryItems,
  consumptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addon: Addon | null;
  inventoryItems: { id: string; name: string; unit: string }[];
  consumptions: AddonConsumptionRow[];
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [, startTransition] = useTransition();
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState("");

  if (!addon) return null;

  const a = addon;
  const assignedIds = new Set(consumptions.map((c) => c.inventory_item_id));
  const availableItems = inventoryItems.filter((i) => !assignedIds.has(i.id));

  async function addConsumption(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !qty) return;
    setWorking(true);
    const res = await setAddonConsumption(a.id, selectedItem, Number(qty));
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumo agregado");
    setSelectedItem("");
    setQty("");
    startTransition(() => router.refresh());
  }

  async function removeConsumption(id: string) {
    setWorking(true);
    const res = await deleteAddonConsumption(id);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumo eliminado");
    startTransition(() => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Consumos de insumos · {addon.name}</DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-xs text-muted-foreground">
          Estos insumos se suman al descuento de inventario cuando el cliente
          agrega este adicional (× la cantidad del adicional × las unidades del
          producto). Ej: si la hamburguesa ya lleva gaseosa y piden 1 extra, se
          descuentan 2.
        </p>

        {/* Agregar consumo */}
        <form onSubmit={addConsumption} className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Agregar insumo</p>
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <div className="space-y-1">
              <Label>Insumo</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.length === 0 ? (
                    <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                      Todos los insumos ya están asignados
                    </div>
                  ) : (
                    availableItems.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cant.</Label>
              <Input
                type="number"
                min={0.001}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className="w-20"
                required
              />
            </div>
            <Button type="submit" size="icon" disabled={working || !selectedItem || !qty}>
              <Plus className="size-4" />
            </Button>
          </div>
        </form>

        {/* Lista de consumos */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Insumos asignados</p>
          {consumptions.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No hay consumos configurados para esta adición.
            </p>
          ) : (
            consumptions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{c.item?.name ?? "Insumo"}</span>
                  <span className="ml-2 text-muted-foreground">
                    {c.quantity} {c.item?.unit ?? ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeConsumption(c.id)}
                  disabled={working}
                  className="text-destructive hover:opacity-70"
                  aria-label="Quitar insumo"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
