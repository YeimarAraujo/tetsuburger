"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Plus, Save, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";
import {
  addPromotionGift,
  deletePromotionRule,
  removePromotionGift,
  savePromotionRule,
  setPromotionGiftActive,
} from "@/features/promotions/actions";
import { formatCOP } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface PromotionGiftRow {
  id: string;
  product_id: string;
  is_active: boolean;
}

export interface PromotionRuleRow {
  id: string;
  name: string;
  min_total: number;
  free_delivery: boolean;
  is_active: boolean;
  gifts: PromotionGiftRow[];
}

export interface PromotionProduct {
  id: string;
  name: string;
  cost: number;
  is_active: boolean;
}

export interface GiftStat {
  name: string;
  count: number;
  cost: number;
}

/** Si el regalo cuesta más de este % del monto mínimo, se avisa. */
const COST_WARNING_PCT = 5;

/** Regalo por monto y domicilio gratis son reglas distintas. */
type RuleKind = "GIFT" | "DELIVERY";

function kindOf(rule: PromotionRuleRow): RuleKind {
  // Una regla antigua que mezcla ambos beneficios se trata como regalo y
  // muestra su interruptor de domicilio para poder separarla.
  return rule.free_delivery && rule.gifts.length === 0 ? "DELIVERY" : "GIFT";
}

export function PromotionManager({
  rules,
  products,
  stats,
}: {
  rules: PromotionRuleRow[];
  products: PromotionProduct[];
  stats: GiftStat[];
}) {
  const [creating, setCreating] = useState<RuleKind | null>(null);

  const giftRules = rules.filter((r) => kindOf(r) === "GIFT");
  const deliveryRules = rules.filter((r) => kindOf(r) === "DELIVERY");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Cómo funcionan</CardTitle>
          <CardDescription>
            Aplican solo a pedidos hechos desde la web.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              El monto se compara con el <strong>subtotal</strong> (productos y
              adicionales), sin contar el domicilio.
            </li>
            <li>
              Los <strong>regalos</strong> y el <strong>domicilio gratis</strong>{" "}
              son reglas independientes: un pedido puede recibir uno, otro o
              ambos según el monto que alcance.
            </li>
            <li>
              El regalo sale de la regla de regalo alcanzada de mayor monto. Si
              hay varios, se sortea uno al azar entre los que tengan stock; si
              ninguno tiene, no se da regalo.
            </li>
            <li>
              El cliente ve que hay un <strong>regalo sorpresa</strong>, pero solo
              descubre cuál al confirmar el pedido.
            </li>
            <li>
              El regalo descuenta inventario según la receta del producto elegido.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Regalos por monto */}
      <section className="space-y-4" aria-labelledby="sec-regalos">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="sec-regalos" className="flex items-center gap-2 text-lg font-bold">
              <Gift className="size-5 text-muted-foreground" />
              Regalos por monto
            </h2>
            <p className="text-sm text-muted-foreground">
              Un regalo sorpresa al llegar a cierto monto de compra.
            </p>
          </div>
          <Button onClick={() => setCreating("GIFT")} disabled={creating === "GIFT"}>
            <Plus className="size-4" />
            Nueva regla de regalo
          </Button>
        </div>

        {creating === "GIFT" ? (
          <RuleCard
            key="new-gift"
            kind="GIFT"
            rule={null}
            products={products}
            onDone={() => setCreating(null)}
          />
        ) : null}

        {giftRules.length === 0 && creating !== "GIFT" ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay reglas de regalo.
            </CardContent>
          </Card>
        ) : null}

        {giftRules.map((rule) => (
          <RuleCard key={rule.id} kind="GIFT" rule={rule} products={products} />
        ))}
      </section>

      {/* Domicilio gratis por monto */}
      <section className="space-y-4" aria-labelledby="sec-domicilio">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="sec-domicilio" className="flex items-center gap-2 text-lg font-bold">
              <Truck className="size-5 text-muted-foreground" />
              Domicilio gratis por monto
            </h2>
            <p className="text-sm text-muted-foreground">
              El domicilio sin costo para el cliente al llegar a cierto monto.
            </p>
          </div>
          <Button
            onClick={() => setCreating("DELIVERY")}
            disabled={creating === "DELIVERY"}
          >
            <Plus className="size-4" />
            Nueva regla de domicilio
          </Button>
        </div>

        {creating === "DELIVERY" ? (
          <RuleCard
            key="new-delivery"
            kind="DELIVERY"
            rule={null}
            products={products}
            onDone={() => setCreating(null)}
          />
        ) : null}

        {deliveryRules.length === 0 && creating !== "DELIVERY" ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay reglas de domicilio gratis.
            </CardContent>
          </Card>
        ) : null}

        {deliveryRules.map((rule) => (
          <RuleCard key={rule.id} kind="DELIVERY" rule={rule} products={products} />
        ))}
      </section>

      <GiftStats stats={stats} />
    </div>
  );
}

function RuleCard({
  kind,
  rule,
  products,
  onDone,
}: {
  kind: RuleKind;
  rule: PromotionRuleRow | null;
  products: PromotionProduct[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(rule?.name ?? "");
  const [minTotal, setMinTotal] = useState(rule ? String(rule.min_total) : "");
  const [freeDelivery, setFreeDelivery] = useState(
    rule?.free_delivery ?? kind === "DELIVERY"
  );
  const [isActive, setIsActive] = useState(rule?.is_active ?? false);
  const [giftToAdd, setGiftToAdd] = useState("");

  const productById = new Map(products.map((p) => [p.id, p]));
  const gifts = rule?.gifts ?? [];
  const takenIds = new Set(gifts.map((g) => g.product_id));
  const available = products.filter((p) => p.is_active && !takenIds.has(p.id));

  const activeGiftCosts = gifts
    .filter((g) => g.is_active)
    .map((g) => productById.get(g.product_id))
    .filter((p): p is PromotionProduct => Boolean(p?.is_active))
    .map((p) => Number(p.cost) || 0);
  const avgCost =
    activeGiftCosts.length > 0
      ? activeGiftCosts.reduce((s, c) => s + c, 0) / activeGiftCosts.length
      : 0;
  const minTotalNum = Number(minTotal);
  const costPct =
    minTotalNum > 0 && avgCost > 0 ? (avgCost / minTotalNum) * 100 : 0;

  const hasNoBenefit =
    kind === "GIFT" && activeGiftCosts.length === 0 && !freeDelivery;
  // Regla antigua que mezclaba regalo y domicilio gratis: se deja separar.
  const isMixedLegacy = kind === "GIFT" && Boolean(rule?.free_delivery);

  const dirty =
    !rule ||
    name !== rule.name ||
    minTotalNum !== Number(rule.min_total) ||
    freeDelivery !== rule.free_delivery ||
    isActive !== rule.is_active;

  async function handleSave() {
    setSaving(true);
    const result = await savePromotionRule(rule?.id ?? null, {
      name,
      min_total: minTotalNum,
      free_delivery: freeDelivery,
      is_active: isActive,
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(rule ? "Regla guardada" : "Regla creada");
    onDone?.();
    startTransition(() => router.refresh());
  }

  async function runAction(
    action: () => Promise<{ error?: string }>,
    success: string
  ) {
    const result = await action();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(success);
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (!rule) return;
    setConfirmDelete(false);
    await runAction(() => deletePromotionRule(rule.id), "Regla eliminada");
  }

  const busy = saving || isPending;

  return (
    <Card className={rule && !rule.is_active ? "opacity-80" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {rule
              ? name || "Regla sin nombre"
              : kind === "GIFT"
                ? "Nueva regla de regalo"
                : "Nueva regla de domicilio gratis"}
            {rule ? (
              <Badge variant={rule.is_active ? "default" : "secondary"}>
                {rule.is_active ? "Activa" : "Pausada"}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {minTotalNum > 0
              ? `Pedidos desde ${formatCOP(minTotalNum)}`
              : "Define el monto mínimo"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`active-${rule?.id ?? "new"}`} className="text-sm">
            Activa
          </Label>
          <Switch
            id={`active-${rule?.id ?? "new"}`}
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`name-${rule?.id ?? "new"}`}>Nombre (interno)</Label>
            <Input
              id={`name-${rule?.id ?? "new"}`}
              value={name}
              maxLength={60}
              placeholder={
                kind === "GIFT" ? "Ej: Regalo sorpresa" : "Ej: Domicilio gratis"
              }
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`min-${rule?.id ?? "new"}`}>Monto mínimo (COP)</Label>
            <Input
              id={`min-${rule?.id ?? "new"}`}
              type="number"
              min={1000}
              step={1000}
              inputMode="numeric"
              value={minTotal}
              placeholder="50000"
              onChange={(e) => setMinTotal(e.target.value)}
            />
          </div>
        </div>

        {kind === "DELIVERY" ? (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Desde este monto el domicilio no tiene costo para el cliente. Solo
              aplica cuando elige domicilio y el costo del mensajero lo asumes tú.
            </p>
          </div>
        ) : null}

        {isMixedLegacy ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <Label htmlFor={`free-${rule?.id ?? "new"}`}>Domicilio gratis</Label>
                <p className="text-sm text-muted-foreground">
                  Esta regla mezcla regalo y domicilio gratis. Apágalo y crea una
                  regla aparte en «Domicilio gratis por monto».
                </p>
              </div>
            </div>
            <Switch
              id={`free-${rule?.id ?? "new"}`}
              checked={freeDelivery}
              onCheckedChange={setFreeDelivery}
            />
          </div>
        ) : null}

        {/* Regalos: solo en reglas de regalo y después de crearlas */}
        {kind === "DELIVERY" ? null : rule ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Regalos posibles</h3>
            </div>

            {gifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin regalos. Agrega uno para que esta regla dé un regalo sorpresa.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {gifts.map((gift) => {
                  const product = productById.get(gift.product_id);
                  return (
                    <li
                      key={gift.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {product?.name ?? "Producto eliminado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Costo: {formatCOP(Number(product?.cost ?? 0))}
                          {product && !product.is_active
                            ? " · producto inactivo (no se regala)"
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={gift.is_active}
                          aria-label={`Regalo ${product?.name ?? ""} activo`}
                          onCheckedChange={(checked) =>
                            runAction(
                              () => setPromotionGiftActive(gift.id, checked),
                              checked ? "Regalo activado" : "Regalo pausado"
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${product?.name ?? "regalo"}`}
                          onClick={() =>
                            runAction(
                              () => removePromotionGift(gift.id),
                              "Regalo quitado"
                            )
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={giftToAdd}
                onChange={(e) => setGiftToAdd(e.target.value)}
                aria-label="Producto a regalar"
                className="h-9 min-w-52 flex-1 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Elegir producto…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · costo {formatCOP(Number(p.cost) || 0)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={!giftToAdd || busy}
                onClick={async () => {
                  await runAction(
                    () => addPromotionGift(rule.id, giftToAdd),
                    "Regalo agregado"
                  );
                  setGiftToAdd("");
                }}
              >
                <Plus className="size-4" />
                Agregar regalo
              </Button>
            </div>

            {activeGiftCosts.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Costo promedio del regalo: <strong>{formatCOP(Math.round(avgCost))}</strong>
                {costPct > 0 ? ` (≈ ${costPct.toFixed(1)}% del monto mínimo)` : ""}
                {activeGiftCosts.length > 1
                  ? ` · se sortea entre ${activeGiftCosts.length} regalos`
                  : ""}
              </p>
            ) : null}

            {costPct > COST_WARNING_PCT ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                El regalo cuesta más del {COST_WARNING_PCT}% del pedido mínimo. Revisa que
                el margen siga siendo bueno.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Crea la regla y luego agrega los regalos posibles.
          </p>
        )}

        {rule && hasNoBenefit ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Esta regla no da nada todavía (sin regalos activos ni domicilio gratis), así
            que no se mostrará a los clientes.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          {rule ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 className="size-4" />
              Eliminar regla
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
              Cancelar
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={busy || !dirty}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="size-4" />
                {rule ? "Guardar cambios" : "Crear regla"}
              </>
            )}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta regla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina junto con su lista de regalos y deja de aplicarse a los
              pedidos nuevos. Los pedidos ya hechos no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function GiftStats({ stats }: { stats: GiftStat[] }) {
  const totalCount = stats.reduce((s, r) => s + r.count, 0);
  const totalCost = stats.reduce((s, r) => s + r.cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regalos entregados</CardTitle>
        <CardDescription>
          Últimos 30 días, sin contar pedidos cancelados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se ha regalado nada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Regalo</th>
                  <th className="pb-2 pr-2 text-right font-medium">Cantidad</th>
                  <th className="pb-2 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.name} className="border-b last:border-0">
                    <td className="py-2 pr-2">{row.name}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.count}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-2 pr-2">Total</td>
                  <td className="pt-2 pr-2 text-right tabular-nums">{totalCount}</td>
                  <td className="pt-2 text-right tabular-nums">
                    {formatCOP(totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
