"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
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
import { createProduct, setProductActive, setProductFeatured, updateProduct } from "@/features/products/actions";
import {
  copyConsumptions,
  deleteProductConsumption,
  setProductConsumption,
  updateProductConsumptionCost,
  updateProductConsumptionQuantity,
} from "@/features/consumption/actions";
import { formatCOP } from "@/lib/format";
import {
  fullCostPrice,
  foodCostPct,
  suggestedPrice,
  type BusinessCostsInput,
} from "@/lib/pricing";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";

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
  /** Tiene consumos configurados: su costo se calcula solo. */
  hasRecipe: boolean;
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
  /** Costos del negocio (Rentabilidad) para calcular el precio sugerido completo. */
  businessCosts: BusinessCostsInput;
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

export function ProductManager({
  products,
  categories,
  addons,
  inventoryItems,
  consumptions,
  businessCosts,
}: Props) {
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

  const [dialogTab, setDialogTab] = useState<"general" | "receta" | "precio">("general");

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

  const pager = usePagination(filtered);

  function openCreate() {
    setEditing(null);
    setDialogTab("general");
    setIsActive(true);
    setIsAvailable(true);
    setIsFeatured(false);
    setFormKey((k) => k + 1);
    setPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(product: ProductRow, tab: "general" | "receta" = "general") {
    setEditing(product);
    setDialogTab(tab);
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
                  pager.visible.map((p) => (
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
                          {p.hasRecipe && Math.round(p.autoCost) === Math.round(p.cost) ? (
                            <p className="text-[10px] text-muted-foreground" title="Calculado desde los consumos de insumos + empaque">
                              desde receta
                            </p>
                          ) : null}
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
                          <Button variant="outline" size="sm" onClick={() => openEdit(p, "receta")}>
                            <Dumbbell className="size-3.5" />
                            Receta
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
          <TablePagination pager={pager} />
        </CardContent>
      </Card>

      {/* Producto + receta + precio en un solo diálogo (se remonta en cada apertura) */}
      <ProductDialog
        key={`${editing?.id ?? "nuevo"}-${formKey}`}
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        editing={editing}
        initialTab={dialogTab}
        categories={categories}
        addons={addons}
        inventoryItems={inventoryItems}
        consumptions={consumptions.filter((c) => c.product_id === editing?.id)}
        allProducts={products}
        businessCosts={businessCosts}
        saving={saving}
        error={error}
        preview={preview}
        setPreview={setPreview}
        isActive={isActive}
        isAvailable={isAvailable}
        isFeatured={isFeatured}
        onSubmit={handleSubmit}
      />
    </>
  );
}

/* ------------------------------- Receta y costo ------------------------------- */

const round2 = (n: number) => Math.round(n * 100) / 100;

function unitValue(c: ConsumptionRow): number {
  return Number(c.unit_cost) || Number(c.item?.cost) || 0;
}

function CostLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", strong && "font-semibold")}>
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-price" : undefined}>{formatCOP(value)}</span>
    </div>
  );
}

/** Una fila de la receta: cantidad editable, valor del insumo y su peso en el costo. */
function RecipeRow({
  c,
  costTotal,
  working,
  onQuantity,
  onCost,
  onRemove,
}: {
  c: ConsumptionRow;
  costTotal: number;
  working: boolean;
  onQuantity: (c: ConsumptionRow, value: number) => Promise<boolean>;
  onCost: (c: ConsumptionRow, value: number) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [qty, setQty] = useState(String(c.quantity));
  const [editingCost, setEditingCost] = useState(false);
  const [costValue, setCostValue] = useState("");

  const unit = unitValue(c);
  const line = Number(c.quantity) * unit;
  const share = costTotal > 0 ? Math.min(100, (line / costTotal) * 100) : 0;
  const ownValue = Number(c.unit_cost) > 0 && Number(c.unit_cost) !== Number(c.item?.cost);

  async function commitQuantity() {
    const value = Number(qty);
    if (!(value > 0)) {
      setQty(String(c.quantity));
      return;
    }
    if (value === Number(c.quantity)) return;
    if (!(await onQuantity(c, value))) setQty(String(c.quantity));
  }

  async function commitCost() {
    const value = Number(costValue);
    if (!(value > 0)) {
      setEditingCost(false);
      return;
    }
    if (await onCost(c, value)) setEditingCost(false);
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
        {editingCost ? (
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={costValue}
              onChange={(e) => setCostValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCost();
                if (e.key === "Escape") setEditingCost(false);
              }}
              autoFocus
              className="h-7 w-24 rounded border bg-transparent px-1.5 text-xs font-semibold"
            />
            <button
              type="button"
              onClick={commitCost}
              className="rounded bg-emerald-500 px-1.5 py-0.5 text-white hover:bg-emerald-600"
              aria-label="Guardar valor"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingCost(false)}
              className="rounded bg-zinc-300 px-1.5 py-0.5 text-zinc-700 hover:bg-zinc-400"
              aria-label="Cancelar"
            >
              <X className="size-3.5" />
            </button>
            <span className="text-muted-foreground">Cambia el costo en todos los productos.</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>{formatCOP(unit)} / {c.item?.unit ?? "und"}</span>
            {ownValue ? (
              <span
                className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                title="Este consumo usa un valor distinto al del inventario"
              >
                valor propio
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setCostValue(String(unit));
                setEditingCost(true);
              }}
              className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Editar costo del insumo"
            >
              <Pencil className="size-3" />
            </button>
          </div>
        )}
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

function RecipePanel({
  product,
  inventoryItems,
  consumptions,
  allProducts,
  packagingInput,
  onPackagingChange,
  ingredientTotal,
  packagingValue,
}: {
  product: ProductRow | null;
  inventoryItems: { id: string; name: string; unit: string; cost: number }[];
  consumptions: ConsumptionRow[];
  allProducts: ProductRow[];
  packagingInput: string;
  onPackagingChange: (value: string) => void;
  ingredientTotal: number;
  packagingValue: number;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [, startTransition] = useTransition();
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState("");
  const [costInput, setCostInput] = useState("");
  const [copyFrom, setCopyFrom] = useState("");

  const assignedIds = new Set(consumptions.map((c) => c.inventory_item_id));
  const availableItems = inventoryItems.filter((i) => !assignedIds.has(i.id));
  const otherProducts = allProducts.filter((p) => p.id !== product?.id);
  const selectedCost = Number(inventoryItems.find((i) => i.id === selectedItem)?.cost) || 0;

  async function addConsumption(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !selectedItem || !qty) return;
    setWorking(true);
    const res = await setProductConsumption(
      product.id,
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
    if (!product || !copyFrom) return;
    setWorking(true);
    const res = await copyConsumptions(copyFrom, product.id);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Consumos copiados");
    setCopyFrom("");
    startTransition(() => router.refresh());
  }

  async function saveCost(c: ConsumptionRow, value: number): Promise<boolean> {
    setWorking(true);
    const res = await updateProductConsumptionCost(c.id, value, c.inventory_item_id);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    toast.success(`Costo de ${c.item?.name ?? "el insumo"} actualizado en todos los productos`);
    startTransition(() => router.refresh());
    return true;
  }

  async function saveQuantity(c: ConsumptionRow, value: number): Promise<boolean> {
    setWorking(true);
    const res = await updateProductConsumptionQuantity(c.id, value);
    setWorking(false);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <div className="space-y-6">
      {product ? (
        <>
          <p className="text-xs text-muted-foreground">
            Los cambios de la receta se guardan al instante y se descuentan del inventario por cada
            unidad vendida.
          </p>

          {/* Insumos asignados */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium">
              Insumos de la receta{consumptions.length > 0 ? ` (${consumptions.length})` : ""}
            </h3>

            {consumptions.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Este producto aún no tiene receta.
              </p>
            ) : (
              consumptions.map((c) => (
                <RecipeRow
                  key={`${c.id}-${c.quantity}-${c.unit_cost}-${c.item?.cost}`}
                  c={c}
                  costTotal={ingredientTotal + packagingValue}
                  working={working}
                  onQuantity={saveQuantity}
                  onCost={saveCost}
                  onRemove={removeConsumption}
                />
              ))
            )}
          </section>

          {/* Agregar insumo */}
          <form onSubmit={addConsumption} className="space-y-3 rounded-lg border p-3">
            <h3 className="text-sm font-medium">Agregar insumo</h3>
            <div className="space-y-1.5">
              <Label>Insumo</Label>
              <Select
                value={selectedItem}
                onValueChange={(v) => {
                  setSelectedItem(v);
                  setCostInput("");
                }}
              >
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
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1.5">
                <Label>Cantidad</Label>
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
              <div className="space-y-1.5">
                <Label>Valor / und (opcional)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder={selectedCost > 0 ? String(selectedCost) : "Inventario"}
                />
              </div>
              <Button type="submit" disabled={working || !selectedItem || !qty}>
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Déjalo vacío para usar el costo del inventario: si el insumo sube de precio, el costo
              del producto se actualiza solo.
            </p>
          </form>
        </>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Guarda el producto para poder armar su receta de insumos.
        </p>
      )}

      {/* Empaque (campo del formulario del producto) */}
      <section className="space-y-1.5">
        <Label htmlFor="prod-packaging">Empaque por unidad (COP)</Label>
        <Input
          id="prod-packaging"
          name="packaging_cost"
          form="product-form"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={packagingInput}
          onChange={(e) => onPackagingChange(e.target.value)}
          placeholder="0"
          className="sm:max-w-48"
        />
        <p className="text-xs text-muted-foreground">
          Caja, bolsa, etiqueta y servilleta de una unidad.
        </p>
      </section>

      {/* Desglose del costo */}
      {consumptions.length > 0 ? (
        <section className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-sm">
          <CostLine label="Insumos" value={ingredientTotal} />
          <CostLine label="Empaque" value={packagingValue} />
          <div className="border-t pt-1.5">
            <CostLine label="Costo del producto" value={ingredientTotal + packagingValue} strong />
          </div>
        </section>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Sin receta, el costo es manual (pestaña Precio) y debe incluir el empaque.
        </p>
      )}

      {/* Copiar desde otro producto */}
      {product ? (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
            Copiar receta desde otro producto
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t p-3">
            <p className="text-xs text-muted-foreground">
              Reemplaza los consumos actuales de este producto.
            </p>
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
        </details>
      ) : null}
    </div>
  );
}

/* ---------------------------------- Diálogo ---------------------------------- */

type DialogTab = "general" | "receta" | "precio";

function ProductDialog({
  open,
  onOpenChange,
  editing,
  initialTab,
  categories,
  addons,
  inventoryItems,
  consumptions,
  allProducts,
  businessCosts,
  saving,
  error,
  preview,
  setPreview,
  isActive,
  isAvailable,
  isFeatured,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProductRow | null;
  initialTab: DialogTab;
  categories: Props["categories"];
  addons: Addon[];
  inventoryItems: Props["inventoryItems"];
  consumptions: ConsumptionRow[];
  allProducts: ProductRow[];
  businessCosts: BusinessCostsInput;
  saving: boolean;
  error: string | null;
  preview: string | null;
  setPreview: (url: string | null) => void;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const shownImage = preview ?? (editing?.image_url || null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tab, setTab] = useState<DialogTab>(initialTab);
  const [priceInput, setPriceInput] = useState(editing ? String(editing.price) : "");
  const [costInput, setCostInput] = useState(editing ? String(editing.cost) : "");
  const [packagingInput, setPackagingInput] = useState(
    editing ? String(editing.packaging_cost ?? 0) : "0"
  );
  const [burgerCount, setBurgerCount] = useState(editing ? editing.conteo_hamburguesas : 0);
  const [perroCount, setPerroCount] = useState(editing ? editing.conteo_perros : 0);

  const ingredientTotal = round2(consumptions.reduce((sum, c) => sum + Number(c.quantity) * unitValue(c), 0));
  const hasRecipe = consumptions.length > 0;
  const packagingValue = Number(packagingInput) || 0;
  const costValue = hasRecipe ? round2(ingredientTotal + packagingValue) : Number(costInput) || 0;
  const priceValue = Number(priceInput) || 0;

  const foodCost = foodCostPct(priceValue, costValue);
  const profit = priceValue - costValue;
  const foodCostRef = suggestedPrice(costValue);
  const fullPrice =
    costValue > 0
      ? fullCostPrice(
          {
            ingredientes: hasRecipe ? ingredientTotal : Math.max(0, costValue - packagingValue),
            empaque: packagingValue,
          },
          businessCosts
        ).precio
      : 0;

  function onCategoryChange(categoryId: string) {
    if (editing) return;
    const cat = categories.find((c) => c.id === categoryId);
    const name = (cat?.name ?? "").toLowerCase();
    setBurgerCount(name.includes("hamburguesa") ? 1 : 0);
    setPerroCount(name.includes("perro") ? 1 : 0);
  }

  // Los campos obligatorios pueden estar en una pestaña oculta: se abre la
  // pestaña del primer campo inválido antes de mostrar el aviso del navegador.
  function onSaveClick(e: React.MouseEvent<HTMLButtonElement>) {
    const form = formRef.current;
    if (!form || form.checkValidity()) return;
    e.preventDefault();
    const target = form.querySelector(":invalid")?.closest("[data-tab]")?.getAttribute("data-tab");
    if (target === "general" || target === "precio") setTab(target);
    setTimeout(() => form.reportValidity(), 0);
  }

  const foodCostTone =
    foodCost <= 0
      ? "text-muted-foreground"
      : foodCost <= 30
        ? "text-emerald-600"
        : foodCost <= 40
          ? "text-amber-600"
          : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" bodyClassName="p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as DialogTab)} className="gap-0">
          <div className="sticky top-0 z-10 space-y-3 rounded-t-xl border-b bg-popover px-5 pt-4 pb-3 pr-12">
            <DialogTitle className="text-base">
              {editing ? `Editar: ${editing.name}` : "Nuevo producto"}
            </DialogTitle>
            <TabsList className="h-9! w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="receta">Receta y costo</TabsTrigger>
              <TabsTrigger value="precio">Precio</TabsTrigger>
            </TabsList>
          </div>

          <form id="product-form" ref={formRef} onSubmit={onSubmit}>
            <input type="hidden" name="is_active" value={isActive ? "on" : ""} />
            <input type="hidden" name="is_available" value={isAvailable ? "on" : ""} />
            <input type="hidden" name="is_featured" value={isFeatured ? "on" : ""} />

            {/* General */}
            <TabsContent
              value="general"
              forceMount
              data-tab="general"
              className="space-y-6 px-5 py-5 data-[state=inactive]:hidden"
            >
              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
                    <Label>Categoría *</Label>
                    <Select
                      name="category_id"
                      defaultValue={editing?.category_id ?? undefined}
                      onValueChange={onCategoryChange}
                    >
                      <SelectTrigger className="w-full">
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
                <div className="space-y-1.5">
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
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Imagen
                </h3>
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
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <ImageIcon className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <input
                      ref={fileRef}
                      type="file"
                      name="image_file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      tabIndex={-1}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setFileName(file?.name ?? null);
                        setPreview(file ? URL.createObjectURL(file) : null);
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                      <ImageIcon className="size-4" />
                      {shownImage ? "Cambiar imagen" : "Subir imagen"}
                    </Button>
                    <p className="truncate text-xs text-muted-foreground">
                      {preview && fileName ? fileName : "JPG, PNG o WebP · máx. 3 MB"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Adicionales aplicables
                </h3>
                {addons.length > 0 ? (
                  <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
                    {addons
                      .filter((a) => a.is_active || editing?.product_addons.some((pa) => pa.addon_id === a.id))
                      .map((addon) => (
                        <label
                          key={addon.id}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              name="addon_ids"
                              value={addon.id}
                              defaultChecked={editing?.product_addons.some(
                                (pa) => pa.addon_id === addon.id
                              )}
                              className="size-4 shrink-0 accent-primary"
                            />
                            <span className="truncate">{addon.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            +{formatCOP(addon.price)}
                          </span>
                        </label>
                      ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Aún no hay adicionales creados. Créalos en{" "}
                    <span className="font-medium">Panel → Adicionales</span>.
                  </p>
                )}
              </section>

              <details className="group rounded-lg border">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
                  Avanzado: combos (conteo de hamburguesas y perros)
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-4 border-t p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-burger-count">Hamburguesas</Label>
                    <Input
                      id="prod-burger-count"
                      name="conteo_hamburguesas"
                      type="number"
                      min={0}
                      step={1}
                      value={burgerCount}
                      onChange={(e) => setBurgerCount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-perro-count">Perros</Label>
                    <Input
                      id="prod-perro-count"
                      name="conteo_perros"
                      type="number"
                      min={0}
                      step={1}
                      value={perroCount}
                      onChange={(e) => setPerroCount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Cuántas hamburguesas y perros representa cada unidad vendida. Sirve para contar los combos.
                  </p>
                </div>
              </details>
            </TabsContent>

            {/* Precio */}
            <TabsContent
              value="precio"
              forceMount
              data-tab="precio"
              className="space-y-5 px-5 py-5 data-[state=inactive]:hidden"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-price">Precio de venta (COP) *</Label>
                  <Input
                    id="prod-price"
                    name="price"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={priceInput}
                    placeholder="25000"
                    onChange={(e) => setPriceInput(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-cost">Costo (COP)</Label>
                  <Input
                    id="prod-cost"
                    name="cost"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={hasRecipe ? String(costValue) : costInput}
                    readOnly={hasRecipe}
                    className={hasRecipe ? "bg-muted" : undefined}
                    placeholder="0"
                    onChange={(e) => setCostInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {hasRecipe
                      ? "Calculado desde la receta (insumos + empaque)."
                      : "Sin receta: escríbelo tú, incluyendo el empaque."}
                  </p>
                </div>
              </div>

              {costValue > 0 ? (
                <>
                  <div className="space-y-1.5 rounded-lg border p-3 text-sm">
                    <CostLine label="Costo (insumos + empaque)" value={costValue} />
                    <CostLine label="Precio de venta" value={priceValue} />
                    <div className="border-t pt-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Utilidad por unidad</span>
                        <span className={profit < 0 ? "text-red-600" : undefined}>
                          {formatCOP(profit)}
                          {priceValue > 0 ? ` · ${((profit / priceValue) * 100).toFixed(0)} %` : ""}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El costo es el{" "}
                      <span className={cn("font-semibold", foodCostTone)}>
                        {priceValue > 0 ? `${foodCost.toFixed(1)} %` : "—"}
                      </span>{" "}
                      del precio (meta: 30 % o menos).
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg border border-dashed bg-muted/50 p-3">
                    {fullPrice > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            Precio sugerido:{" "}
                            <span className="font-bold text-primary">{formatCOP(fullPrice)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cubre insumos, empaque, costos fijos, comisiones y tu utilidad
                            objetivo (la misma cuenta de Rentabilidad).
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={priceValue === fullPrice}
                          onClick={() => setPriceInput(String(fullPrice))}
                        >
                          Usar este precio
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Configura tus costos fijos y comisiones en Rentabilidad para ver el precio
                        sugerido que cubre todo el negocio.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Referencia por food cost (costo = 30 % de la venta):{" "}
                      <span className="font-medium text-foreground">{formatCOP(foodCostRef)}</span>
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Carga el costo (o arma la receta) para calcular el margen y el precio sugerido.
                </p>
              )}
            </TabsContent>
          </form>

          {/* Receta y costo: fuera del <form> (tiene sus propios formularios) */}
          <TabsContent
            value="receta"
            forceMount
            data-tab="receta"
            className="px-5 py-5 data-[state=inactive]:hidden"
          >
            <RecipePanel
              product={editing}
              inventoryItems={inventoryItems}
              consumptions={consumptions}
              allProducts={allProducts}
              packagingInput={packagingInput}
              onPackagingChange={setPackagingInput}
              ingredientTotal={ingredientTotal}
              packagingValue={packagingValue}
            />
          </TabsContent>

          {/* Resumen siempre visible + acciones */}
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
                  <dd className="font-semibold">{costValue > 0 ? formatCOP(costValue) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Precio</dt>
                  <dd className="font-semibold">{priceValue > 0 ? formatCOP(priceValue) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Utilidad</dt>
                  <dd className={cn("font-semibold", profit < 0 && "text-red-600")}>
                    {costValue > 0 && priceValue > 0 ? formatCOP(profit) : "—"}
                  </dd>
                </div>
              </dl>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" form="product-form" disabled={saving} onClick={onSaveClick}>
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
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
