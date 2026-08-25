"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Addon } from "@/types/db";
import {
  createAddon,
  setAddonActive,
  updateAddon,
} from "@/features/products/actions";
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
import { Switch } from "@/components/ui/switch";

export function AddonManager({ initial }: { initial: Addon[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                        <Button variant="outline" size="sm" onClick={() => openEdit(addon)}>
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
    </>
  );
}
