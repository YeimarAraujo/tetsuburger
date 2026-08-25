"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Pencil, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import type { Addon, Category } from "@/types/db";
import {
  createProduct,
  setProductActive,
  setProductAvailable,
  setProductFeatured,
  updateProduct,
} from "@/features/products/actions";
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
}

type StatusFilter = "todos" | "activos" | "inactivos" | "agotados" | "destacados";

export function ProductManager({ products, categories, addons }: Props) {
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
  const formRef = useRef<HTMLFormElement>(null);

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
    setPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    setPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
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
            <CardTitle>Productos</CardTitle>
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
                  <th className="hidden pb-2 pr-2 font-medium sm:table-cell">Estado</th>
                  <th className="pb-2 pr-2 font-medium">Activo</th>
                  <th className="pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No hay productos que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 align-middle">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="size-11 shrink-0 rounded-md border object-cover"
                            />
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
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
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

      {/* Disponibilidad rápida desde la fila se hace vía editar; agregamos switch de agotado dentro del diálogo */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        editing={editing}
        categories={categories}
        addons={addons}
        saving={saving}
        error={error}
        preview={preview}
        setPreview={setPreview}
        onSubmit={handleSubmit}
      />
    </>
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
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [isActive, setIsActive] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Sincroniza los switches cada vez que cambia el producto a editar
  useMemo(() => {
    if (open) {
      setIsActive(editing ? editing.is_active : true);
      setIsAvailable(editing ? editing.is_available : true);
      setIsFeatured(editing ? editing.is_featured : false);
      setFormKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const shownImage = preview ?? (editing?.image_url || null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Editar: ${editing.name}` : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <form key={formKey} onSubmit={onSubmit} className="space-y-4">
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
              <Select name="category_id" defaultValue={editing?.category_id ?? undefined}>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-price">Precio (COP) *</Label>
              <Input
                id="prod-price"
                name="price"
                type="number"
                min={0}
                step={100}
                defaultValue={editing?.price ?? ""}
                placeholder="25000"
                required
              />
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sw-active" className="text-sm">Activo</Label>
                <Switch id="sw-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sw-available" className="text-sm">
                  Disponible{" "}
                  <span className="font-normal text-muted-foreground">(agotable hoy)</span>
                </Label>
                <Switch id="sw-available" checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sw-featured" className="text-sm">Destacado</Label>
                <Switch id="sw-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
            </div>
          </div>

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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shownImage}
                  alt="Vista previa"
                  className="size-20 rounded-md border object-cover"
                />
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
