"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgePercent,
  Building2,
  Calculator,
  Check,
  CircleDollarSign,
  Eye,
  Home,
  Loader2,
  Settings2,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/lib/format";
import {
  breakEvenPrice,
  bucketState,
  fixedCostShare,
  fullCostBreakdown,
  fullCostPrice,
  totalCostosFijos,
  type BusinessCostsInput,
} from "@/lib/pricing";
import type { FixedCostSuggestion } from "@/lib/sales-analytics";
import { updateProductPrice } from "@/features/products/actions";
import { ROUNDING_OPTIONS, type BusinessConfig } from "@/features/rentabilidad/config";
import { saveBusinessCosts } from "@/features/rentabilidad/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/admin/kpi-card";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

export interface RentabilidadRow {
  id: string;
  name: string;
  price: number;
  /** products.cost: ingredientes + empaque (automático si tiene receta). */
  cost: number;
  packaging_cost: number;
  category: string | null;
  hasRecipe: boolean;
  /** Unidades vendidas (entregadas) en los últimos 30 días. */
  sold30: number;
}

export interface AddonRow {
  id: string;
  name: string;
  price: number;
  cost: number;
  hasRecipe: boolean;
  sold30: number;
}

interface RealData {
  sales30: number;
  cost30: number;
  orders30: number;
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function unitCosts(p: Pick<RentabilidadRow, "cost" | "packaging_cost">) {
  return { ingredientes: Math.max(0, p.cost - p.packaging_cost), empaque: p.packaging_cost };
}

export function RentabilidadManager({
  products,
  addons,
  initialConfig,
  real,
  suggestion,
}: {
  products: RentabilidadRow[];
  addons: AddonRow[];
  initialConfig: BusinessConfig;
  real: RealData | null;
  suggestion: FixedCostSuggestion;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [config, setConfig] = useState<BusinessConfig>(initialConfig);
  const [breakdownProduct, setBreakdownProduct] = useState<RentabilidadRow | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const latestConfig = useRef(config);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function update<K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) {
    const next = { ...latestConfig.current, [key]: value };
    latestConfig.current = next;
    setConfig(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveBusinessCosts(latestConfig.current);
      saveTimer.current = null;
    }, 700);
  }

  const realSales = real?.sales30 ?? 0;
  const ventasMes = config.ventasMes > 0 ? config.ventasMes : realSales;

  const input = useMemo<BusinessCostsInput>(
    () => ({
      nomina: config.nomina,
      arriendo: config.arriendo,
      servicios: config.servicios,
      otrosFijos: config.otrosFijos,
      ventasMes,
      utilidadObjetivo: config.utilidadPct / 100,
      comisionPct: config.comisionPct / 100,
      comisionFija: config.comisionFija,
      redondeo: config.redondeo,
    }),
    [config, ventasMes]
  );

  const share = fixedCostShare(input);
  const fijosTotales = totalCostosFijos(input);

  const rows = useMemo(() => {
    return products
      .map((p) => {
        const unit = unitCosts(p);
        const margin = p.price - p.cost;
        const pct = p.price > 0 ? (margin / p.price) * 100 : 0;
        const sugg = fullCostPrice(unit, input).precio;
        const be = breakEvenPrice(unit, input);
        return { ...p, margin, pct, sugg, be };
      })
      .sort((a, b) => b.sold30 - a.sold30 || a.name.localeCompare(b.name));
  }, [products, input]);

  const sortedAddons = useMemo(
    () => [...addons].sort((a, b) => b.sold30 - a.sold30 || a.name.localeCompare(b.name)),
    [addons]
  );
  const productPages = usePagination(rows);
  const addonPages = usePagination(sortedAddons);

  const actionButtons = (p: (typeof rows)[number]) => (
    <>
      <Button variant="outline" size="sm" onClick={() => setBreakdownProduct(p)}>
        <Eye className="size-3.5" />
        Simular
      </Button>
      <Button
        size="sm"
        disabled={applying === p.id || isPending || p.sugg <= 0 || p.cost <= 0 || p.sugg === p.price}
        onClick={() => applyPrice(p, p.sugg)}
      >
        {applying === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Aplicar
      </Button>
    </>
  );

  const impactIfApplied = rows.reduce(
    (s, r) => (r.sugg > 0 && r.sold30 > 0 ? s + (r.sugg - r.price) * r.sold30 : s),
    0
  );
  const grossReal = real ? real.sales30 - real.cost30 : 0;
  const commissionsReal = real ? real.sales30 * input.comisionPct + real.orders30 * input.comisionFija : 0;
  const netReal = grossReal - commissionsReal - fijosTotales;

  async function applyPrice(p: RentabilidadRow, precio: number) {
    if (precio <= 0) {
      toast.error("Completa los costos para poder sugerir un precio");
      return;
    }
    setApplying(p.id);
    const res = await updateProductPrice(p.id, precio);
    setApplying(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${p.name}: precio actualizado a ${formatCOP(precio)}`);
    setBreakdownProduct(null);
    startTransition(() => router.refresh());
  }

  const fixedFields: {
    key: "nomina" | "arriendo" | "servicios" | "otrosFijos";
    label: string;
    icon: typeof Users;
    suggested: number;
    hint?: string;
  }[] = [
    { key: "nomina", label: "Nómina mensual", icon: Users, suggested: suggestion.nomina },
    { key: "arriendo", label: "Arriendo mensual", icon: Home, suggested: suggestion.arriendo },
    { key: "servicios", label: "Servicios (luz, gas, agua, internet)", icon: Zap, suggested: suggestion.servicios },
    {
      key: "otrosFijos",
      label: "Otros costos fijos",
      icon: Building2,
      suggested: suggestion.otrosFijos,
      hint: suggestion.otrosCategorias.length > 0 ? suggestion.otrosCategorias.join(", ") : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Datos del negocio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-4" />
            Datos del negocio
          </CardTitle>
          <CardDescription>
            Se guardan para todo el equipo. Los costos fijos se reparten como un porcentaje de tus ventas:
            cada producto aporta según su precio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rent-ventas">Ventas del mes (COP)</Label>
              <Input
                id="rent-ventas"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={config.ventasMes || ""}
                placeholder={realSales > 0 ? String(Math.round(realSales)) : "0"}
                onChange={(e) => update("ventasMes", num(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {config.ventasMes > 0 ? (
                  <>
                    Estimado manual.{" "}
                    {realSales > 0 ? (
                      <button type="button" className="font-medium text-price hover:underline" onClick={() => update("ventasMes", 0)}>
                        Usar ventas reales ({formatCOP(realSales)})
                      </button>
                    ) : null}
                  </>
                ) : realSales > 0 ? (
                  `Usando tus ventas reales de los últimos 30 días: ${formatCOP(realSales)}.`
                ) : (
                  "Aún no hay ventas entregadas en 30 días: escribe un estimado."
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rent-utilidad">Utilidad neta objetivo (%)</Label>
              <Input
                id="rent-utilidad"
                type="number"
                min={0}
                max={90}
                step="any"
                value={config.utilidadPct}
                onChange={(e) => update("utilidadPct", num(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Lo que quieres que quede limpio de cada venta.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Redondear precios a</Label>
              <Select value={String(config.redondeo)} onValueChange={(v) => update("redondeo", Number(v))}>
                <SelectTrigger aria-label="Redondear precios a">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUNDING_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {formatCOP(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">El precio sugerido se sube al múltiplo más cercano.</p>
            </div>

            {fixedFields.map((f) => {
              const Icon = f.icon;
              const value = config[f.key];
              const suggested = Math.round(f.suggested);
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`rent-${f.key}`} className="flex items-center gap-1">
                    <Icon className="size-3.5" /> {f.label}
                  </Label>
                  <Input
                    id={`rent-${f.key}`}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => update(f.key, num(e.target.value))}
                  />
                  {suggested > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Tus gastos reales: {formatCOP(suggested)}/mes
                      {f.hint ? ` (${f.hint})` : ""}.{" "}
                      {Math.round(value) !== suggested ? (
                        <button type="button" className="font-medium text-price hover:underline" onClick={() => update(f.key, suggested)}>
                          Usar
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={Building2}
              label="Costos fijos/mes"
              value={formatCOP(fijosTotales)}
              help={{
                what: "Lo que pagas cada mes vendas o no: nómina, arriendo, servicios y otros.",
                formula: "nómina + arriendo + servicios + otros",
              }}
            />
            <KpiCard
              icon={Calculator}
              label="De cada venta, para fijos"
              value={fijosTotales > 0 && ventasMes > 0 ? `${(share * 100).toFixed(1)}%` : "—"}
              caption={ventasMes > 0 ? `sobre ${formatCOP(ventasMes)} de ventas/mes` : "Falta el dato de ventas"}
              help={{
                what: "Qué parte de cada peso vendido se necesita para cubrir los costos fijos.",
                formula: "costos fijos ÷ ventas del mes",
                suggestion: "Si pasa de ~35%, tus fijos son altos para lo que vendes: sube ventas o baja fijos.",
              }}
            />
            {real ? (
              <KpiCard
                icon={Wallet}
                tileClassName={netReal >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
                iconClassName={netReal >= 0 ? "text-emerald-600" : "text-red-600"}
                label="Utilidad neta estimada (30 días)"
                value={formatCOP(netReal)}
                valueClassName={netReal >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}
                caption={`Ganancia bruta ${formatCOP(grossReal)} − fijos − comisiones`}
                help={{
                  what: "Lo que dejaron tus ventas reales del último mes después del costo de lo vendido, las comisiones y los costos fijos que escribiste aquí.",
                  formula: "ventas − costo de lo vendido − comisiones − costos fijos",
                }}
              />
            ) : null}
            <KpiCard
              icon={TrendingUp}
              label="Si aplicas los precios sugeridos"
              value={`${impactIfApplied >= 0 ? "+" : ""}${formatCOP(impactIfApplied)}`}
              caption="al mes, con las mismas unidades de los últimos 30 días"
              help={{
                what: "Diferencia de ingresos si cada producto vendido en el último mes hubiera tenido su precio sugerido.",
                formula: "Σ (precio sugerido − precio actual) × unidades vendidas en 30 días",
                suggestion: "Supone que vendes lo mismo; subir mucho un precio puede bajar las ventas.",
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Productos */}
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Ordenados por lo que más se vendió en los últimos 30 días. El costo de los productos con receta se calcula solo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos activos</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Producto</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium lg:table-cell">Vendidos 30 d</th>
                  <th className="pb-2 pr-2 text-right font-medium">Precio</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium sm:table-cell">Costo</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium md:table-cell">Margen bruto</th>
                  <th className="pb-2 pr-2 text-right font-medium">Sugerido</th>
                  <th className="hidden pb-2 text-right font-medium sm:table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productPages.visible.map((p) => {
                  const losing = p.cost > 0 && p.be > 0 && p.price < p.be;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{p.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                          {p.category ? <span>{p.category}</span> : null}
                          {p.cost <= 0 ? (
                            <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800 dark:text-amber-300">
                              <TriangleAlert className="size-3" /> Sin costo
                            </Badge>
                          ) : !p.hasRecipe ? (
                            <Badge variant="outline" className="text-[10px]">Costo manual</Badge>
                          ) : null}
                          {losing ? (
                            <Badge variant="outline" className="border-red-300 text-[10px] text-red-700 dark:text-red-300">
                              <TriangleAlert className="size-3" /> No cubre sus costos
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">
                          Costo {p.cost > 0 ? formatCOP(p.cost) : "—"} · {p.sold30} vendidos
                        </p>
                        <div className="mt-1.5 flex gap-1 sm:hidden">{actionButtons(p)}</div>
                      </td>
                      <td className="hidden py-2 pr-2 text-right tabular-nums lg:table-cell">{p.sold30 || "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCOP(p.price)}</td>
                      <td className="hidden py-2 pr-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                        {p.cost > 0 ? formatCOP(p.cost) : "—"}
                      </td>
                      <td className="hidden py-2 pr-2 text-right md:table-cell">{p.cost > 0 ? <MarginBadge pct={p.pct} /> : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {p.sugg > 0 && p.cost > 0 ? (
                          <span className={cn("font-medium", p.sugg > p.price ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                            {p.sugg > p.price ? "↑ " : "✓ "}
                            {formatCOP(p.sugg)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden py-2 text-right sm:table-cell">
                        <div className="flex justify-end gap-1">{actionButtons(p)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <TablePagination pager={productPages} />
          <p className="mt-3 text-xs text-muted-foreground">
            ↑ el precio está por debajo del sugerido · ✓ ya lo cubre. Precio sugerido = (ingredientes + empaque + comisión fija) ÷
            (1 − utilidad − comisión % − % para fijos), redondeado a {formatCOP(config.redondeo)}. Los productos con{" "}
            <span className="font-medium">costo manual</span> no tienen receta: configúrala en{" "}
            <Link href="/admin/productos" className="font-medium text-price hover:underline">Productos</Link> para que su costo se actualice solo.
          </p>
        </CardContent>
      </Card>

      {/* Adicionales */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionales</CardTitle>
          <CardDescription>Los extras suelen dejar más margen que los productos: conviene sugerirlos.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay adicionales activos</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Adicional</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium sm:table-cell">Vendidos 30 d</th>
                  <th className="pb-2 pr-2 text-right font-medium">Precio</th>
                  <th className="hidden pb-2 pr-2 text-right font-medium sm:table-cell">Costo</th>
                  <th className="pb-2 pr-2 text-right font-medium">Margen</th>
                  <th className="hidden pb-2 text-right font-medium md:table-cell">Ganancia 30 d</th>
                </tr>
              </thead>
              <tbody>
                {addonPages.visible.map((a) => {
                    const margin = a.price - a.cost;
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium">{a.name}</p>
                          {!a.hasRecipe ? <p className="text-[11px] text-muted-foreground">Sin consumos configurados</p> : null}
                          <p className="text-[11px] text-muted-foreground sm:hidden">
                            Costo {a.cost > 0 ? formatCOP(a.cost) : "—"} · {a.sold30} vendidos
                          </p>
                        </td>
                        <td className="hidden py-2 pr-2 text-right tabular-nums sm:table-cell">{a.sold30 || "—"}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatCOP(a.price)}</td>
                        <td className="hidden py-2 pr-2 text-right tabular-nums text-muted-foreground sm:table-cell">{a.cost > 0 ? formatCOP(a.cost) : "—"}</td>
                        <td className="py-2 pr-2 text-right">
                          {a.cost > 0 && a.price > 0 ? <MarginBadge pct={(margin / a.price) * 100} /> : "—"}
                        </td>
                        <td className="hidden py-2 text-right tabular-nums md:table-cell">
                          {a.cost > 0 && a.sold30 > 0 ? formatCOP(margin * a.sold30) : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
          <TablePagination pager={addonPages} />
        </CardContent>
      </Card>

      <SimulatorDialog
        key={breakdownProduct?.id ?? "cerrado"}
        product={breakdownProduct}
        input={input}
        onClose={() => setBreakdownProduct(null)}
        onApply={applyPrice}
        applying={applying}
        isPending={isPending}
      />
    </div>
  );
}

function MarginBadge({ pct }: { pct: number }) {
  if (pct >= 60) {
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{pct.toFixed(1)}%</Badge>;
  }
  if (pct >= 45) {
    return <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300">{pct.toFixed(1)}%</Badge>;
  }
  return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400">{pct.toFixed(1)}%</Badge>;
}

function SimulatorDialog({
  product,
  input,
  onClose,
  onApply,
  applying,
  isPending,
}: {
  product: RentabilidadRow | null;
  input: BusinessCostsInput;
  onClose: () => void;
  onApply: (p: RentabilidadRow, precio: number) => void;
  applying: string | null;
  isPending: boolean;
}) {
  const breakdown = useMemo(
    () => (product ? fullCostBreakdown(unitCosts(product), input) : null),
    [product, input]
  );
  const [testPrice, setTestPrice] = useState(() => String(product?.price ?? ""));

  if (!product) return null;

  const be = breakEvenPrice(unitCosts(product), input);
  const share = fixedCostShare(input);
  const test = num(testPrice);
  const commission = (price: number) => price * input.comisionPct + input.comisionFija;
  const netPerUnit = (price: number) => price - product.cost - commission(price) - price * share;
  const currentNet = netPerUnit(product.price);
  const testNet = netPerUnit(test);
  const monthlyDiff = (test - product.price) * product.sold30;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="size-4" />
            {product.name}
          </DialogTitle>
          <DialogDescription>
            Costo {formatCOP(product.cost)} por unidad · {product.sold30} vendidos en los últimos 30 días
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Simulador */}
          <div className="rounded-lg border p-3">
            <Label htmlFor="sim-price" className="text-sm font-semibold">¿Y si lo vendo a…?</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="sim-price"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={testPrice}
                onChange={(e) => setTestPrice(e.target.value)}
                className="max-w-40"
              />
              {breakdown && breakdown.precio > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setTestPrice(String(breakdown.precio))}>
                  Probar sugerido
                </Button>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-muted p-2.5">
                <dt className="text-xs text-muted-foreground">Utilidad neta por unidad</dt>
                <dd className={cn("text-lg font-bold", testNet >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                  {formatCOP(testNet)}
                </dd>
                <dd className="text-[11px] text-muted-foreground">Hoy: {formatCOP(currentNet)}</dd>
              </div>
              <div className="rounded-md bg-muted p-2.5">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  Cambio al mes
                  <InfoTip
                    content={{
                      what: "Cuánto más (o menos) ingresarías al mes con este precio si vendes las mismas unidades que en los últimos 30 días.",
                      formula: "(precio de prueba − precio actual) × vendidos en 30 días",
                    }}
                  />
                </dt>
                <dd className={cn("text-lg font-bold", monthlyDiff >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                  {monthlyDiff >= 0 ? "+" : ""}
                  {formatCOP(monthlyDiff)}
                </dd>
                <dd className="text-[11px] text-muted-foreground">con las mismas ventas</dd>
              </div>
            </dl>
            {test > 0 && be > 0 && test < be ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                <TriangleAlert className="size-3.5" /> Por debajo de {formatCOP(be)} este producto no cubre sus costos.
              </p>
            ) : null}
            <Button
              className="mt-3 w-full"
              variant="outline"
              disabled={applying === product.id || isPending || test <= 0 || test === product.price}
              onClick={() => onApply(product, Math.round(test))}
            >
              {applying === product.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar {test > 0 ? formatCOP(test) : ""} como precio
            </Button>
          </div>

          {/* Desglose del precio sugerido */}
          {breakdown && breakdown.precio > 0 ? (
            <>
              <p className="text-sm font-semibold">Cómo se arma el precio sugerido ({formatCOP(breakdown.precio)})</p>
              <div className="space-y-2">
                {breakdown.buckets.map((b) => {
                  const state = bucketState(b.pct, b.rangeMin, b.rangeMax);
                  return (
                    <div key={b.label} className="rounded-md border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{b.label}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">ideal {b.rangeMin}-{b.rangeMax}%</span>
                          <Badge variant="outline" className="text-[10px]">
                            {b.pct.toFixed(1)}% · {state === "ok" ? "en rango" : state === "bajo" ? "bajo" : "alto"}
                          </Badge>
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{formatCOP(Math.round(b.pesos))}</span>
                        <div className="h-2 w-2/3 overflow-hidden rounded-r-[4px] bg-muted" aria-hidden="true">
                          <div className="h-full rounded-r-[4px] bg-primary" style={{ width: `${Math.min(100, Math.max(0, b.pct))}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Punto de equilibrio (sin utilidad): {formatCOP(be)}. Los fijos son el {(share * 100).toFixed(1)}% de cada venta.
              </p>
              <Button
                className="w-full"
                disabled={applying === product.id || isPending || breakdown.precio === product.price}
                onClick={() => onApply(product, breakdown.precio)}
              >
                {applying === product.id ? <Loader2 className="size-4 animate-spin" /> : <CircleDollarSign className="size-4" />}
                Aplicar precio sugerido ({formatCOP(breakdown.precio)})
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se puede sugerir un precio: la utilidad objetivo, las comisiones y los costos fijos se llevan más del 95% de
              cada venta. Revisa los datos del negocio.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
