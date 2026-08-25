"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/types/db";
import type { CategoryInput } from "@/features/categories/schema";
import {
  createCategory,
  moveCategory,
  setCategoryActive,
  updateCategory,
} from "@/features/categories/actions";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface FormState {
  name: string;
  description: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  image_url: "",
  display_order: 0,
  is_active: true,
};

export function CategoryManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description,
      image_url: category.image_url,
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = editing
      ? await updateCategory(editing.id, form)
      : await createCategory(form);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(
      editing ? "Categoría actualizada" : "Categoría creada"
    );
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleToggle(category: Category, isActive: boolean) {
    const result = await setCategoryActive(category.id, isActive);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(isActive ? "Categoría activada" : "Categoría desactivada");
    startTransition(() => router.refresh());
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const result = await moveCategory(id, direction);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Categorías</CardTitle>
            <CardDescription>
              Organiza el menú. Las categorías inactivas no aparecen en el
              catálogo público.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nueva categoría
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Orden</th>
                  <th className="pb-2 pr-2 font-medium">Nombre</th>
                  <th className="hidden pb-2 pr-2 font-medium md:table-cell">
                    Descripción
                  </th>
                  <th className="pb-2 pr-2 font-medium">Activa</th>
                  <th className="pb-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {initial.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay categorías todavía. Crea la primera.
                    </td>
                  </tr>
                ) : (
                  initial.map((category, index) => (
                    <tr key={category.id} className="border-b last:border-0">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={index === 0 || isPending}
                            onClick={() => handleMove(category.id, "up")}
                            aria-label="Subir"
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={index === initial.length - 1 || isPending}
                            onClick={() => handleMove(category.id, "down")}
                            aria-label="Bajar"
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <span className="font-medium">{category.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          /{category.slug}
                        </span>
                      </td>
                      <td className="hidden max-w-[240px] truncate py-3 pr-2 text-muted-foreground md:table-cell">
                        {category.description || "—"}
                      </td>
                      <td className="py-3 pr-2">
                        <Switch
                          checked={category.is_active}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            handleToggle(category, checked)
                          }
                          aria-label={`Activar ${category.name}`}
                        />
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => openEdit(category)}
                        >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Hamburguesas"
                required
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc">Descripción</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Descripción breve (opcional)"
                maxLength={200}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-order">Orden</Label>
                <Input
                  id="cat-order"
                  type="number"
                  min={0}
                  value={form.display_order}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      display_order: parseInt(e.target.value || "0", 10),
                    })
                  }
                />
              </div>
              <div className="flex items-end justify-between gap-2 pb-1">
                <Label htmlFor="cat-active">Activa</Label>
                <Switch
                  id="cat-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_active: checked })
                  }
                />
              </div>
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
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
                  "Crear categoría"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
