"use client";

import { useRef, useState, useTransition } from "react";
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
  updateAddonConsumptionQuantity,
} from "@/features/consumption/actions";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";

interface AddonConsumptionRow {
  id: string;
  addon_id: string;
  inventory_item_id: string;
  quantity: number;
  item?: { name: string; unit: string; cost: number } | null;
}

type InventoryOption = { id: string; name: string; unit: string; cost: number };

export function AddonManager({
  initial,
  inventoryItems,
  consumptions,
}: {
  initial: Addon[];
  inventoryItems: InventoryOption[];
  consumptions: AddonConsumptionRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState<"general" | "receta">("general");
  const [formKey, setFormKey] = useState(0);
  const pager = usePagination(initial);

  const addonConsumptions = new Map<string, AddonConsumptionRow[]>();
  for (const c of consumptions) {
    const list = addonConsumptions.get(c.addon_id) ?? [];
    list.push(c);
    addonConsumptions.set(c.addon_id, list);
  }

  function openCreate() {
    setEditing(null);
    setDialogTab("general");
    setFormKey((k) => k + 1);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(addon: Addon, tab: "general" | "receta" = "general") {
    setEditing(addon);
    setDialogTab(tab);
    setFormKey((k) => k + 1);
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
            <CardTitle>Lista de adicionales</CardTitle>
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
                  pager.visible.map((addon) => (
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
                          <Button variant="outline" size="sm" onClick={() => openEdit(addon, "receta")}>
                            Receta
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
          <TablePagination pager={pager} />
        </CardContent>
      </Card>

      {/* Adicional + receta en un solo diálogo (se remonta en cada apertura) */}
      <AddonDialog
        key={`${editing?.id ?? "nuevo"}-${formKey}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        initialTab={dialogTab}
        inventoryItems={inventoryItems}
        consumptions={editing ? addonConsumptions.get(editing.id) ?? [] : []}
        saving={saving}
        error={error}
        onSubmit={handleSubmit}
      />
    </>
  );
}

/* ------------------------------- Receta y costo ------------------------------- */

const costOf = (c: AddonConsumptionRow) => Number(c.quantity) * (Number(c.item?.cost) || 0);

function AddonRecipeRow({
  c,
  costTotal,
  working,
  onQuantity,
  onRemove,
}: {
  c: AddonConsumptionRow;
  costTotal: number;
  working: boolean;
  onQuantity: (c: AddonConsumptionRow, value: number) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [qty, setQty] = useState(String(c.quantity));
  const unitCost = Number(c.item?.cost) || 0;
  const line = costOf(c);
  const share = costTotal > 0 ? Math.min(100, (line / costTotal) * 100) : 0;

  async function commitQuantity() {
    const value = Number(qty);
    if (!(value > 0)) {
      setQty(String(c.quantity));
      return;
    }
    if (value === Number(c.quantity)) return;
    if (!(await onQuantity(c, value))) setQty(String(c.quantity));
  }

  return (
    <div className="space-y-1.5 rounded-lg border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{c.item?.name ?? "Insumo"}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            type="number"
            min={0.001}
            step="any"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={commitQuantity}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            disabled={working}
            aria-label={`Cantidad de ${c.item?.name ?? "insumo"}`}
            className="h-8 w-20 rounded-md border bg-transparent px-2 text-right text-sm tabular-nums"
          />
          <span className="w-12 text-xs text-muted-foreground">{c.item?.unit ?? ""}</span>
          <button
            type="button"
            onClick={() => onRemove(c.id)}
            disabled={working}
            className="text-destructive hover:opacity-70"
            aria-label="Quitar insumo"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={unitCost > 0 ? "text-muted-foreground" : "text-amber-600"}>
          {unitCost > 0
            ? `${formatCOP(unitCost)} / ${c.item?.unit ?? "und"}`
            : "Insumo sin costo en inventario"}
        </span>
        <span className="shrink-0 font-semibold">
          {formatCOP(line)}
          <span className="ml-1.5 font-normal text-muted-foreground">{share.toFixed(0)} %</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary/60" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

function AddonRecipePanel({
  addon,
  inventoryItems,
  consumptions,
  costTotal,
}: {
  addon: Addon | null;
  inventoryItems: InventoryOption[];
  consumptions: AddonConsumptionRow[];
  costTotal: number;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [, startTransition] = useTransition();
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState("");

  const assignedIds = new Set(consumptions.map((c) => c.inventory_item_id));
  const availableItems = inventoryItems.filter((i) => !assignedIds.has(i.id));

  async function addConsumption(e: React.FormEvent) {
    e.preventDefault();
    if (!addon || !selectedItem || !qty) return;
    setWorking(true);
    const res = await setAddonConsumption(addon.id, selectedItem, Number(qty));
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

  async function saveQuantity(c: AddonConsumptionRow, value: number): Promise<boolean> {
    setWorking(true);
    const res = await updateAddonConsumptionQuantity(c.id, value);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  if (!addon) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        Guarda el adicional para poder armar su receta de insumos.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Los cambios se guardan al instante. Estos insumos se descuentan del inventario cada vez que
        el cliente agrega este adicional (× su cantidad × las unidades del producto). Ej: si la
        hamburguesa ya lleva gaseosa y piden 1 extra, se descuentan 2.
      </p>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">
          Insumos de la receta{consumptions.length > 0 ? ` (${consumptions.length})` : ""}
        </h3>
        {consumptions.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Este adicional aún no tiene receta.
          </p>
        ) : (
          consumptions.map((c) => (
            <AddonRecipeRow
              key={`${c.id}-${c.quantity}-${c.item?.cost}`}
              c={c}
              costTotal={costTotal}
              working={working}
              onQuantity={saveQuantity}
              onRemove={removeConsumption}
            />
          ))
        )}
      </section>

      <form onSubmit={addConsumption} className="space-y-3 rounded-lg border p-3">
        <h3 className="text-sm font-medium">Agregar insumo</h3>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
          <div className="space-y-1.5">
            <Label>Insumo</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger className="w-full">
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
                      {i.name} ({i.unit}) · {formatCOP(i.cost)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0.001}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="w-24"
              required
            />
          </div>
          <Button type="submit" disabled={working || !selectedItem || !qty}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </form>

      {consumptions.length > 0 ? (
        <section className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>Costo del adicional</span>
            <span className="text-price">{formatCOP(costTotal)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Suma de cantidad × costo de cada insumo en el inventario. Se actualiza solo si cambia el
            costo de un insumo.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------------- Diálogo ---------------------------------- */

type AddonTab = "general" | "receta";

function AddonDialog({
  open,
  onOpenChange,
  editing,
  initialTab,
  inventoryItems,
  consumptions,
  saving,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Addon | null;
  initialTab: AddonTab;
  inventoryItems: InventoryOption[];
  consumptions: AddonConsumptionRow[];
  saving: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<AddonTab>(initialTab);
  const [priceInput, setPriceInput] = useState(editing ? String(editing.price) : "");

  const costTotal = consumptions.reduce((sum, c) => sum + costOf(c), 0);
  const priceValue = Number(priceInput) || 0;
  const profit = priceValue - costTotal;
  const hasCost = consumptions.length > 0;

  // El nombre y el precio están en la pestaña General: si faltan y se guarda
  // desde otra pestaña, se vuelve a General antes de mostrar el aviso.
  function onSaveClick(e: React.MouseEvent<HTMLButtonElement>) {
    const form = formRef.current;
    if (!form || form.checkValidity()) return;
    e.preventDefault();
    setTab("general");
    setTimeout(() => form.reportValidity(), 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" bodyClassName="p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as AddonTab)} className="gap-0">
          <div className="sticky top-0 z-10 space-y-3 rounded-t-xl border-b bg-popover px-5 pt-4 pb-3 pr-12">
            <DialogTitle className="text-base">
              {editing ? `Editar: ${editing.name}` : "Nuevo adicional"}
            </DialogTitle>
            <TabsList className="h-9! w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="receta">Receta y costo</TabsTrigger>
            </TabsList>
          </div>

          <form id="addon-form" ref={formRef} onSubmit={onSubmit}>
            <TabsContent
              value="general"
              forceMount
              className="space-y-5 px-5 py-5 data-[state=inactive]:hidden"
            >
              <input
                type="hidden"
                name="is_active"
                value={editing ? (editing.is_active ? "on" : "") : "on"}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label htmlFor="addon-price">Precio (COP) *</Label>
                  <Input
                    id="addon-price"
                    name="price"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="3000"
                    required
                  />
                </div>
              </div>

              <label
                htmlFor="addon-acompanamiento"
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">Es acompañamiento</p>
                  <p className="text-xs text-muted-foreground">
                    Gaseosas, porción de papas y paquetes: en la web no se asignan a un producto del
                    combo (solo cantidad).
                  </p>
                </div>
                <input
                  id="addon-acompanamiento"
                  name="es_acompanamiento"
                  type="checkbox"
                  defaultChecked={editing?.tipo === "ACOMPAÑAMIENTO"}
                  className="size-4 shrink-0 accent-primary"
                />
              </label>
            </TabsContent>
          </form>

          {/* Receta: fuera del <form> (tiene sus propios formularios) */}
          <TabsContent
            value="receta"
            forceMount
            className="px-5 py-5 data-[state=inactive]:hidden"
          >
            <AddonRecipePanel
              addon={editing}
              inventoryItems={inventoryItems}
              consumptions={consumptions}
              costTotal={costTotal}
            />
          </TabsContent>

          <div className="sticky bottom-0 z-10 space-y-2 rounded-b-xl border-t bg-popover px-5 py-3">
            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dl className="flex gap-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Costo</dt>
                  <dd className="font-semibold">{hasCost ? formatCOP(costTotal) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Precio</dt>
                  <dd className="font-semibold">{priceValue > 0 ? formatCOP(priceValue) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Utilidad</dt>
                  <dd className={cn("font-semibold", profit < 0 && "text-red-600")}>
                    {hasCost && priceValue > 0 ? formatCOP(profit) : "—"}
                  </dd>
                </div>
              </dl>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" form="addon-form" disabled={saving} onClick={onSaveClick}>
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
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
