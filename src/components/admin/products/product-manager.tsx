"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Dumbbell,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Addon, Category } from "@/types/db";
import { createProduct, setProductActive, setProductFeatured, updateProduct, updateProductCost } from "@/features/products/actions";
import {
  copyConsumptions,
  deleteProductConsumption,
  setProductConsumption,
  updateProductConsumptionCost,
} from "@/features/consumption/actions";
import { formatCOP } from "@/lib/format";
import { suggestedPrice, foodCostPct, grossProfit } from "@/lib/pricing";
import { cn } from "@/lib/utils";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface ProductRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  cost: number;
  packaging_cost: number;
  conteo_hamburguesas: number;
  conteo_perros: number;
  autoCost: number;
  image_url: string;
  is_active: boolean;
  is_available: boolean;
  is_featured: boolean;
  category?: { name: string } | null;
  product_addons: { addon_id: string }[];
}

interface Props {
  products: ProductRow[];
  categories: Pick<Category, "id" | "name">[];
  addons: Addon[];
  inventoryItems: { id: string; name: string; unit: string; cost: number }[];
  consumptions: ConsumptionRow[];
}

export interface ConsumptionRow {
  id: string;
  product_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_cost: number;
  item?: { name: string; unit: string; cost: number } | null;
}

type StatusFilter = "todos" | "activos" | "inactivos" | "agotados" | "destacados";

export function ProductManager({ products, categories, addons, inventoryItems, consumptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [consumptionProduct, setConsumptionProduct] = useState<ProductRow | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.includes(q)) return false;
      if (categoryFilter !== "todas" && p.category_id !== categoryFilter) return false;
      if (statusFilter === "activos" && !p.is_active) return false;
      if (statusFilter === "inactivos" && p.is_active) return false;
      if (statusFilter === "agotados" && p.is_available) return false;
      if (statusFilter === "destacados" && !p.is_featured) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setIsActive(true);
    setIsAvailable(true);
    setIsFeatured(false);
    setFormKey((k) => k + 1);
    setPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    setIsActive(product.is_active);
    setIsAvailable(product.is_available);
    setIsFeatured(product.is_featured);
    setFormKey((k) => k + 1);
    setPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Compress image before upload
    const file = formData.get("image_file");
    if (file instanceof File && file.size > 0) {
      const { compressImage } = await import("@/lib/compress-image");
      const compressed = await compressImage(file);
      formData.set("image_file", compressed);
    }

    const result = editing
      ? await updateProduct(editing.id, formData)
      : await createProduct(formData);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(editing ? "Producto actualizado" : "Producto creado");
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  async function runToggle(
    action: (id: string, v: boolean) => Promise<{ error?: string }>,
    id: string,
    value: boolean,
    msg: string
  ) {
    const result = await action(id, value);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(msg);
    startTransition(() => router.refresh());
  }

  async function applyAutoCost(cost: number): Promise<boolean> {
    if (!editing || cost <= 0) return false;
    const result = await updateProductCost(editing.id, cost);
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success(`Costo del producto actualizado a ${formatCOP(cost)}`);
    setEditing((prev) => (prev ? { ...prev, cost } : prev));
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="inactivos">Inactivos</SelectItem>
            <SelectItem value="agotados">Agotados</SelectItem>
            <SelectItem value="destacados">Destacados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Catálogo de productos</CardTitle>
            <CardDescription>
              {filtered.length} de {products.length} productos · doble control:
              activo (aparece en el catálogo) y disponible (agotado hoy)
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Producto</th>
                  <th className="hidden pb-2 pr-2 font-medium md:table-cell">Categoría</th>
                  <th className="pb-2 pr-2 font-medium">Precio</th>
                  <th className="pb-2 pr-2 font-medium">Costo</th>
                  <th className="hidden pb-2 pr-2 font-medium sm:table-cell">Estado</th>
                  <th className="pb-2 pr-2 font-medium">Activo</th>
                  <th className="pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No hay productos que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 align-middle">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-md border">
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted">
                              <ImageIcon className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                runToggle(
                                  setProductFeatured,
                                  p.id,
                                  !p.is_featured,
                                  p.is_featured ? "Quitado de destacados" : "Marcado como destacado"
                                )
                              }
                              title="Marcar como destacado"
                              className="block max-w-[180px] truncate text-left font-medium hover:text-primary"
                            >
                              {p.name}
                            </button>
                            <Star
                              className={cn(
                                "mt-0.5 size-3",
                                p.is_featured
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground/30"
                              )}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="hidden py-3 pr-2 text-muted-foreground md:table-cell">
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="py-3 pr-2 font-medium">{formatCOP(p.price)}</td>
                      <td className="py-3 pr-2">
                        <div>
                          <p className="font-medium">{formatCOP(p.cost)}</p>
                          {p.autoCost > 0 && Math.round(p.autoCost) !== Math.round(p.cost) ? (
                            <p
                              className="text-[10px] text-muted-foreground"
                              title="Costo calculado desde los consumos de insumos + empaque"
                            >
                              auto: {formatCOP(p.autoCost)}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="hidden py-3 pr-2 sm:table-cell">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                            p.is_available
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {p.is_available ? "Disponible" : "Agotado"}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <Switch
                          checked={p.is_active}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            runToggle(setProductActive, p.id, checked, checked ? "Producto activado" : "Producto desactivado")
                          }
                          aria-label={`Activar ${p.name}`}
                        />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setConsumptionProduct(p)}>
                            <Dumbbell className="size-3.5" />
                            Consumos
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
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

      {/* Disponibilidad rápida desde la fila se hace vía editar; agregamos switch de agotado dentro del diálogo */}
      <ProductDialog
        key={editing?.id ?? "nuevo"}
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        editing={editing}
        categories={categories}
        addons={addons}
        saving={saving}
        error={error}
        preview={preview}
        setPreview={setPreview}
        isActive={isActive}
        isAvailable={isAvailable}
        isFeatured={isFeatured}
        formKey={formKey}
        autoCost={editing?.autoCost ?? 0}
        onApplyAutoCost={applyAutoCost}
        onSubmit={handleSubmit}
      />

      {/* Consumos de insumos por producto */}
      <ConsumptionDialog
        open={Boolean(consumptionProduct)}
        onOpenChange={(open) => !open && setConsumptionProduct(null)}
        product={consumptionProduct}
        inventoryItems={inventoryItems}
        consumptions={consumptions.filter(
          (c) => c.product_id === consumptionProduct?.id
        )}
        allProducts={products}
      />
    </>
  );
}

/* ----------------------------- Diálogo de consumos ---------------------------- */

function ConsumptionDialog({
  open,
  onOpenChange,
  product,
  inventoryItems,
  consumptions,
  allProducts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null;
  inventoryItems: { id: string; name: string; unit: string; cost: number }[];
  consumptions: ConsumptionRow[];
  allProducts: ProductRow[];
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [, startTransition] = useTransition();
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState("");
  const [costInput, setCostInput] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const [editCostId, setEditCostId] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState("");

  if (!product) return null;

  const prod = product;

  const assignedIds = new Set(consumptions.map((c) => c.inventory_item_id));
  const availableItems = inventoryItems.filter((i) => !assignedIds.has(i.id));
  const otherProducts = allProducts.filter((p) => p.id !== prod.id);
  const packagingCost = Number(prod.packaging_cost) || 0;
  const ingredientCostTotal = consumptions.reduce(
    (sum, c) =>
      sum +
      Number(c.quantity) *
        (Number(c.unit_cost) || Number(c.item?.cost) || 0),
    0
  );
  const autoCostTotal = ingredientCostTotal + packagingCost;

  function unitValue(c: ConsumptionRow): number {
    return Number(c.unit_cost) || Number(c.item?.cost) || 0;
  }

  async function addConsumption(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !qty) return;
    setWorking(true);
    const res = await setProductConsumption(
      prod.id,
      selectedItem,
      Number(qty),
      Number(costInput) || 0
    );
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumo agregado");
    setSelectedItem("");
    setQty("");
    setCostInput("");
    startTransition(() => router.refresh());
  }

  async function removeConsumption(id: string) {
    setWorking(true);
    const res = await deleteProductConsumption(id);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumo eliminado");
    startTransition(() => router.refresh());
  }

  async function doCopy() {
    if (!copyFrom) return;
    setWorking(true);
    const res = await copyConsumptions(copyFrom, prod.id);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumos copiados");
    setCopyFrom("");
    startTransition(() => router.refresh());
  }

  async function applyAutoCost() {
    if (autoCostTotal <= 0) return;
    setWorking(true);
    const res = await updateProductCost(prod.id, autoCostTotal);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Costo del producto actualizado a ${formatCOP(autoCostTotal)}`);
    startTransition(() => router.refresh());
  }

  async function saveConsumptionCost(c: ConsumptionRow) {
    const val = Number(editCostValue);
    if (isNaN(val) || val < 0) {
      setEditCostId(null);
      return;
    }
    setWorking(true);
    const res = await updateProductConsumptionCost(c.id, val, c.inventory_item_id);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      setEditCostId(null);
      return;
    }
    toast.success("Valor del consumo actualizado");
    setEditCostId(null);
    startTransition(() => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Consumos de insumos · {product.name}</DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-xs text-muted-foreground">
          Estos insumos se descontarán del inventario al marcar un pedido como
          ENTREGADO. La cantidad se multiplica por cada unidad vendida.
        </p>

        {/* Copiar desde otro producto */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Copiar consumos desde otro producto</p>
          <div className="flex gap-2">
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Elegir producto…" />
              </SelectTrigger>
              <SelectContent>
                {otherProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={doCopy} disabled={working || !copyFrom}>
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
        </div>

        {/* Agregar consumo */}
        <form onSubmit={addConsumption} className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Agregar insumo</p>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Insumo</Label>
              <Select
                value={selectedItem}
                onValueChange={(v) => {
                  setSelectedItem(v);
                  const it = inventoryItems.find((i) => i.id === v);
                  setCostInput(it && Number(it.cost) > 0 ? String(it.cost) : "");
                }}
              >
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
                        {i.name} ({i.unit}) · {formatCOP(i.cost)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Cant.</Label>
                <Input
                  type="number"
                  min={0.001}
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Valor / und (COP)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={working || !selectedItem || !qty}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
        </form>

        {/* Lista de consumos */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Insumos asignados</p>
            <button
              type="button"
              onClick={() => setUnassigned((v) => !v)}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {unassigned ? "Ocultar sin asignar" : "Mostrar sin asignar"}
            </button>
          </div>

          {consumptions.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No hay consumos configurados para este producto.
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
                  <span className="ml-2 font-semibold text-muted-foreground">
                    → {formatCOP(Number(c.quantity) * unitValue(c))}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {editCostId === c.id ? (
                    <>
                      <input
                        type="number"
                        value={editCostValue}
                        onChange={(e) => setEditCostValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveConsumptionCost(c);
                          if (e.key === "Escape") setEditCostId(null);
                        }}
                        className="h-7 w-24 rounded border px-1.5 text-[11px] font-semibold"
                        autoFocus
                        min={0}
                        step="any"
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        onClick={() => saveConsumptionCost(c)}
                        className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-600"
                        aria-label="Guardar valor"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCostId(null)}
                        className="rounded bg-zinc-300 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-400"
                        aria-label="Cancelar"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {formatCOP(unitValue(c))} / und
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCostId(c.id);
                          setEditCostValue(String(unitValue(c)));
                        }}
                        className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                        aria-label="Editar valor del consumo"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeConsumption(c.id)}
                        disabled={working}
                        className="text-destructive hover:opacity-70"
                        aria-label="Quitar insumo"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Costo calculado desde los insumos */}
        <div className="rounded-lg border border-dashed bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">
              Costo automático:{" "}
              <span className="font-bold text-primary">{formatCOP(autoCostTotal)}</span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={working || autoCostTotal <= 0}
              onClick={applyAutoCost}
            >
              Guardar como costo
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Σ (cantidad × costo del insumo) + empaque ({formatCOP(packagingCost)}).
            Se actualiza al registrar compras.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Diálogo ---------------------------------- */

function ProductDialog({
  open,
  onOpenChange,
  editing,
  categories,
  addons,
  saving,
  error,
  preview,
  setPreview,
  isActive,
  isAvailable,
  isFeatured,
  formKey,
  autoCost,
  onApplyAutoCost,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProductRow | null;
  categories: Props["categories"];
  addons: Addon[];
  saving: boolean;
  error: string | null;
  preview: string | null;
  setPreview: (url: string | null) => void;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  formKey: number;
  autoCost: number;
  onApplyAutoCost: (cost: number) => Promise<boolean>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const shownImage = preview ?? (editing?.image_url || null);
  const [priceInput, setPriceInput] = useState(editing ? String(editing.price) : "");
  const [costInput, setCostInput] = useState(editing ? String(editing.cost) : "");
  const [burgerCount, setBurgerCount] = useState(editing ? editing.conteo_hamburguesas : 0);
  const [perroCount, setPerroCount] = useState(editing ? editing.conteo_perros : 0);
  const costValue = Number(costInput) || 0;
  const priceValue = Number(priceInput) || 0;
  const suggPrice = suggestedPrice(costValue);
  const foodCost = foodCostPct(priceValue, costValue);

  function onCategoryChange(categoryId: string) {
    if (editing) return;
    const cat = categories.find((c) => c.id === categoryId);
    const name = (cat?.name ?? "").toLowerCase();
    setBurgerCount(name.includes("hamburguesa") ? 1 : 0);
    setPerroCount(name.includes("perro") ? 1 : 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Editar: ${editing.name}` : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <form key={formKey === 0 ? undefined : formKey} onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="is_active" value={isActive ? "on" : ""} />
          <input type="hidden" name="is_available" value={isAvailable ? "on" : ""} />
          <input type="hidden" name="is_featured" value={isFeatured ? "on" : ""} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-name">Nombre *</Label>
              <Input
                id="prod-name"
                name="name"
                defaultValue={editing?.name ?? ""}
                placeholder="Ej: Hamburguesa Tetsu"
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select
                name="category_id"
                defaultValue={editing?.category_id ?? undefined}
                onValueChange={onCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div key={`pricing-${formKey}`} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-price">Precio (COP) *</Label>
              <Input
                id="prod-price"
                name="price"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                defaultValue={editing?.price ?? ""}
                placeholder="25000"
                onChange={(e) => setPriceInput(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-cost">Costo (COP)</Label>
              <Input
                id="prod-cost"
                name="cost"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={costInput}
                placeholder="0"
                onChange={(e) => setCostInput(e.target.value)}
              />
              {autoCost > 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                  <p className="text-xs text-muted-foreground">
                    Automático (insumos + empaque):{" "}
                    <span className="font-bold text-primary">{formatCOP(autoCost)}</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (await onApplyAutoCost(autoCost)) {
                        setCostInput(String(autoCost));
                      }
                    }}
                  >
                    Usar
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prod-packaging">Costo de empaque (COP)</Label>
              <Input
                id="prod-packaging"
                name="packaging_cost"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                defaultValue={editing?.packaging_cost ?? 0}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Caja, bolsa, etiqueta, servilleta… se suma al costo de ingredientes
                en el simulador de Rentabilidad.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-burger-count">Hamburguesas (conteo)</Label>
              <Input
                id="prod-burger-count"
                name="conteo_hamburguesas"
                type="number"
                min={0}
                step={1}
                value={burgerCount}
                onChange={(e) => setBurgerCount(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Cuántas hamburguesas representa cada unidad vendida (para combos).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-perro-count">Perros (conteo)</Label>
              <Input
                id="prod-perro-count"
                name="conteo_perros"
                type="number"
                min={0}
                step={1}
                value={perroCount}
                onChange={(e) => setPerroCount(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Cuántos perros representa cada unidad vendida (para combos).
              </p>
            </div>
          </div>

          {costValue > 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/50 p-3">
              <p className="text-sm">
                Precio sugerido (costo = 30% de la venta):{" "}
                <span className="font-bold text-primary">{formatCOP(suggPrice)}</span>
              </p>
              {priceValue > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Con tu precio, el costo es el {foodCost.toFixed(1)}% de la venta (
                  {formatCOP(grossProfit(priceValue, costValue))} de utilidad por unidad)
                  {priceValue < suggPrice ? (
                    <span className="font-medium text-amber-600"> — estás por debajo del sugerido.</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pone el precio para ver tu margen actual.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Carga el costo para calcular el precio sugerido automáticamente.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="prod-desc">Descripción</Label>
            <Textarea
              id="prod-desc"
              name="description"
              defaultValue={editing?.description ?? ""}
              placeholder="Ingredientes, preparación…"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Imagen (JPG, PNG o WebP · máx. 3 MB)</Label>
            <div className="flex items-center gap-4">
              {shownImage ? (
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md border">
                  <Image
                    src={shownImage}
                    alt="Vista previa"
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-20 items-center justify-center rounded-md border bg-muted">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <Input
                type="file"
                name="image_file"
                accept="image/jpeg,image/png,image/webp"
                className="flex-1"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </div>
          </div>

          {addons.length > 0 ? (
            <div className="space-y-2">
              <Label>Adicionales aplicables</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-3">
                {addons
                  .filter((a) => a.is_active || editing?.product_addons.some((pa) => pa.addon_id === a.id))
                  .map((addon) => (
                    <label
                      key={addon.id}
                      className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="addon_ids"
                          value={addon.id}
                          defaultChecked={editing?.product_addons.some(
                            (pa) => pa.addon_id === addon.id
                          )}
                          className="size-4 accent-[var(--primary)]"
                        />
                        {addon.name}
                      </span>
                      <span className="text-muted-foreground">+{formatCOP(addon.price)}</span>
                    </label>
                  ))}
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Aún no hay adicionales creados. Créalos en{" "}
              <span className="font-medium">Panel → Adicionales</span>.
            </p>
          )}

          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
                "Crear producto"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
