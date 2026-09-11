"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/lib/format";
import {
  breakEvenPrice,
  bucketState,
  fixedCostPerUnit,
  fullCostBreakdown,
  fullCostPrice,
  totalCostosFijos,
  type BusinessCostsInput,
} from "@/lib/pricing";
import { updateProductPrice } from "@/features/products/actions";
import {
  type BusinessConfig,
} from "@/features/rentabilidad/config";
import { saveBusinessCosts } from "@/features/rentabilidad/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiCard } from "@/components/admin/kpi-card";
import { InfoTip } from "@/components/ui/info-tip";

interface RentabilidadRow {
  id: string;
  name: string;
  price: number;
  cost: number;
  packaging_cost: number;
  category?: { name: string } | null;
  /** Desglose derivado: products.cost ya incluye el empaque. */
  ingredientes?: number;
  empaque?: number;
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function RentabilidadManager({
  products,
  initialConfig,
}: {
  products: RentabilidadRow[];
  initialConfig: BusinessConfig;
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

  function update<K extends keyof BusinessConfig>(key: K, value: number) {
    const next = { ...latestConfig.current, [key]: value };
    latestConfig.current = next;
    setConfig(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveBusinessCosts(latestConfig.current);
      saveTimer.current = null;
    }, 700);
  }

  const input = useMemo<BusinessCostsInput>(
    () => ({
      nomina: config.nomina,
      arriendo: config.arriendo,
      servicios: config.servicios,
      otrosFijos: config.otrosFijos,
      unidadesMes: config.unidadesMes,
      utilidadObjetivo: config.utilidadPct / 100,
      comisionPct: config.comisionPct / 100,
      comisionFija: config.comisionFija,
    }),
    [config]
  );

  const rows = useMemo(() => {
    return products.map((p) => {
      // products.cost ya incluye el empaque (lo escribe el costo automático de
      // productos); packaging_cost solo se desglosa, NUNCA se suma de nuevo.
      const empaque = p.packaging_cost;
      const ingredientes = Math.max(0, p.cost - empaque);
      const unit = { ingredientes, empaque };
      const costoVariable = p.cost;
      const margin = p.price - costoVariable;
      const pct = p.price > 0 ? (margin / p.price) * 100 : 0;
      const sugg = fullCostPrice(unit, input).precio;
      const be = breakEvenPrice(unit, input);
      return { ...p, ingredientes, empaque, costoVariable, margin, pct, sugg, be };
    });
  }, [products, input]);

  const fijosTotales = useMemo(() => totalCostosFijos(input), [input]);
  const fijoUnit = useMemo(() => fixedCostPerUnit(input), [input]);

  const proj = useMemo(() => {
    const avgSugg =
      rows.length > 0 ? rows.reduce((s, r) => s + r.sugg, 0) / rows.length : 0;
    const priced = rows.filter((r) => r.price > 0);
    const avgNetCurrent =
      priced.length > 0
        ? priced.reduce((s, r) => s + (r.price - r.costoVariable - fijoUnit), 0) /
        priced.length
        : 0;
    const units = config.unidadesMes;
    return {
      ingresoProyectado: avgSugg * units,
      utilidadProyectada: avgSugg * units * (config.utilidadPct / 100),
      avgNetCurrent,
      utilidadActualEstimada: avgNetCurrent * units,
    };
  }, [rows, fijoUnit, config.unidadesMes, config.utilidadPct]);

  async function applyPrice(p: RentabilidadRow) {
    const { precio } = fullCostPrice(
      { ingredientes: p.ingredientes ?? Math.max(0, p.cost - p.packaging_cost), empaque: p.empaque ?? p.packaging_cost },
      input
    );
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

  return (
    <div className="space-y-4">
      {/* Datos del negocio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings2 className="size-4" />
            Datos del negocio (costos fijos mensuales y meta)
          </CardTitle>
          <CardDescription>
            Se guardan en este navegador. El precio sugerido cubre ingredientes +
            empaque + comisión + estos costos fijos + tu utilidad neta objetivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Ventas mensuales estimadas (unidades)</Label>
              <Input
                type="number"
                min={1}
                step="any"
                value={config.unidadesMes}
                onChange={(e) => update("unidadesMes", num(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Utilidad neta objetivo (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                step="any"
                value={config.utilidadPct}
                onChange={(e) => update("utilidadPct", num(e.target.value))}
              />
            </div>
            {/* <div className="space-y-1.5">
              <Label>Comisión plataforma (% del precio)</Label>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={config.comisionPct}
                onChange={(e) => update("comisionPct", num(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comisión/domicilio fija por venta (COP)</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={config.comisionFija}
                onChange={(e) => update("comisionFija", num(e.target.value))}
              />
            </div> */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Users className="size-3.5" /> Nómina mensual (COP)
              </Label>
              <Input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={config.nomina}
                onChange={(e) => update("nomina", num(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Home className="size-3.5" /> Arriendo mensual (COP)
              </Label>
              <Input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={config.arriendo}
                onChange={(e) => update("arriendo", num(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Zap className="size-3.5" /> Servicios mensuales (luz, gas,etc)
              </Label>
              <Input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={config.servicios}
                onChange={(e) => update("servicios", num(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Otros costos fijos mensuales</Label>
              <Input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={config.otrosFijos}
                onChange={(e) => update("otrosFijos", num(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              icon={Building2}
              label="Costos fijos/mes"
              value={formatCOP(fijosTotales)}
              help={{
                what: "Los gastos que pagas cada mes sí o sí, vendas o no vendas: nómina, arriendo, servicios y otros costos fijos.",
                formula: "nómina + arriendo + servicios + otros",
                suggestion: "Son la base del precio: hay que repartirlos entre las unidades que vendes al mes.",
              }}
            />

            <KpiCard
              icon={Calculator}
              label={`Fijo por unidad (${config.unidadesMes} ventas/mes)`}
              value={formatCOP(fijoUnit)}
              help={{
                what: "Cuánto de los costos fijos le toca a cada venta, repartido entre las unidades que estimas vender al mes.",
                formula: "costos fijos ÷ ventas mensuales",
                suggestion: "Si vendes menos de lo estimado, el fijo por unidad sube y tu margen real baja. Usa una estimación conservadora.",
              }}
            />

            <KpiCard
              icon={TrendingUp}
              label="Ingreso proyectado con sugeridos"
              value={formatCOP(proj.ingresoProyectado)}
              help={{
                what: "Cuánto facturarías al mes si vendieras todas las unidades al precio sugerido.",
                formula: "precio sugerido promedio × ventas mensuales",
              }}
            />

            <KpiCard
              icon={Wallet}
              label="Utilidad neta proyectada"
              value={formatCOP(proj.utilidadProyectada)}
              help={{
                what: "Ganancia neta mensual esperada si operas al precio sugerido y cumples tu % de utilidad objetivo.",
                formula: "ingreso proyectado × utilidad neta objetivo %",
                suggestion: "Es tu meta: lo que quedaría después de cubrir costos variables y costos fijos.",
              }}
            />

            <KpiCard
              icon={CircleDollarSign}
              tileClassName={proj.utilidadActualEstimada >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
              iconClassName={proj.utilidadActualEstimada >= 0 ? "text-emerald-600" : "text-red-600"}
              label="Con tus precios actuales"
              value={formatCOP(proj.utilidadActualEstimada)}
              valueClassName={proj.utilidadActualEstimada >= 0 ? "text-emerald-600" : "text-red-600"}
              caption="/mes"
              help={{
                what: proj.utilidadActualEstimada >= 0
                  ? "Cuánto ganarías al mes con tus precios actuales, descontando el costo variable y el fijo por unidad."
                  : "Cuánto pierdes al mes con tus precios actuales: no alcanzas a cubrir los costos fijos.",
                formula: "(precio actual − costo variable − fijo por unidad) × ventas mensuales",
                suggestion: proj.utilidadActualEstimada >= 0
                  ? "Estás cubriendo los fijos. Para llegar a tu meta, sube los productos cuyo precio sugerido es mayor al actual."
                  : "No cubres los fijos: sube los precios hacia el sugerido o reduce gastos/costos fijos.",
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="overflow-x-auto py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos activos</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Producto</th>
                  <th className="pb-2 pr-2 font-medium">Categoría</th>
                  <th className="pb-2 pr-2 text-right font-medium">Precio</th>
                  <th className="pb-2 pr-2 text-right font-medium">Costo variable</th>
                  <th className="pb-2 pr-2 text-right font-medium">Margen</th>
                  <th className="pb-2 pr-2 text-right font-medium">Precio sugerido</th>
                  <th className="pb-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{p.name}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{p.category?.name ?? "—"}</td>
                    <td className="py-2 pr-2 text-right">{formatCOP(p.price)}</td>
                    <td className="py-2 pr-2 text-right text-muted-foreground">
                      {formatCOP(p.costoVariable)}
                      <span className="ml-1 text-[10px]">
                        (ingr. {formatCOP(p.ingredientes ?? 0)}
                        {p.empaque && p.empaque > 0 ? ` + emp. ${formatCOP(p.empaque)}` : ""})
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <MarginBadge pct={p.pct} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {p.sugg > 0 ? (
                        p.sugg > p.price ? (
                          <span className="inline-flex items-center gap-1 font-medium text-red-600">
                            <TrendingUp className="size-3.5" /> {formatCOP(p.sugg)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                            <TrendingDown className="size-3.5" /> {formatCOP(p.sugg)}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBreakdownProduct(p)}
                        >
                          <Eye className="size-3.5" />
                          Desglose
                        </Button>
                        <Button
                          size="sm"
                          disabled={applying === p.id || isPending || p.sugg <= 0}
                          onClick={() => applyPrice(p)}
                        >
                          {applying === p.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Aplicar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Precio sugerido = (ingredientes + empaque + fijo por unidad + comisión fija) ÷
            (1 − utilidad objetivo − comisión %). &quot;Aplicar&quot; guarda el precio en el catálogo.
          </p>
        </CardContent>
      </Card>

      {/* Diálogo de desglose */}
      <BreakdownDialog
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
  if (pct >= 50) {
    return <Badge className="bg-emerald-500/15 text-emerald-600">{pct.toFixed(1)}%</Badge>;
  }
  if (pct >= 30) {
    return <Badge className="bg-amber-500/15 text-amber-600">{pct.toFixed(1)}%</Badge>;
  }
  return <Badge className="bg-red-500/15 text-red-600">{pct.toFixed(1)}%</Badge>;
}

function BreakdownDialog({
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
  onApply: (p: RentabilidadRow) => void;
  applying: string | null;
  isPending: boolean;
}) {
  const breakdown = useMemo(() => {
    if (!product) return null;
    return fullCostBreakdown(
      {
        ingredientes: product.ingredientes ?? Math.max(0, product.cost - product.packaging_cost),
        empaque: product.empaque ?? product.packaging_cost,
      },
      input
    );
  }, [product, input]);

  const be = useMemo(() => {
    if (!product) return 0;
    return breakEvenPrice(
      {
        ingredientes: product.ingredientes ?? Math.max(0, product.cost - product.packaging_cost),
        empaque: product.empaque ?? product.packaging_cost,
      },
      input
    );
  }, [product, input]);

  if (!product) return null;

  const varCost = product.cost;
  const currentMargin = product.price - varCost;

  return (
    <Dialog open={Boolean(product)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="size-4" />
            Costo completo: {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Costo variable por unidad (ingredientes + empaque)</p>
              <p className="text-lg font-bold">{formatCOP(varCost)}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Margen actual con tu precio
                <InfoTip
                  content={{
                    what: "Lo que te queda de cada venta con el precio actual, descontando solo ingredientes y empaque (aún no descuenta el fijo por unidad).",
                    formula: "precio actual − costo variable",
                    suggestion: "Si este margen es negativo, cada venta te está haciendo perder plata: revisa el precio o el costo.",
                  }}
                />
              </p>
              <p className={`text-lg font-bold ${currentMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCOP(currentMargin)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {product.price > 0 ? `${((currentMargin / product.price) * 100).toFixed(1)}%` : "—"}
                </span>
              </p>
            </div>
          </div>

          {breakdown && breakdown.precio > 0 ? (
            <>
              <div className="space-y-2">
                {breakdown.buckets.map((b) => {
                  const state = bucketState(b.pct, b.rangeMin, b.rangeMax);
                  return (
                    <div key={b.label} className="rounded-md border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{b.label}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">rango {b.rangeMin}-{b.rangeMax}%</span>
                          <Badge variant="outline" className={`text-[10px] ${state === "ok" ? "text-emerald-600" : state === "bajo" ? "text-amber-600" : "text-red-600"}`}>
                            {b.pct.toFixed(1)}%
                          </Badge>
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-sm font-semibold">{formatCOP(Math.round(b.pesos))}</span>
                        <div className="h-2 w-2/3 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${state === "ok" ? "bg-emerald-500" : state === "bajo" ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, b.pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    Precio sugerido (costo completo)
                    <InfoTip
                      content={{
                        what: "El precio que cubre costo variable + empaque + costos fijos repartidos + un % de utilidad neta objetivo por venta.",
                        formula: "variable + empaque + comisión + fijo por unidad + utilidad objetivo",
                      }}
                    />
                  </p>
                  <p className="text-2xl font-bold text-primary">{formatCOP(breakdown.precio)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="flex items-center justify-end gap-1">
                    Punto de equilibrio (sin utilidad)
                    <InfoTip
                      content={{
                        what: "El precio mínimo para no perder: cubre costos variable + costos fijos, pero deja cero utilidad.",
                        formula: "variable + empaque + comisión + fijo por unidad",
                        suggestion: "Tu precio de venta no debería bajar de aquí; entre este punto y el sugerido sigue estando tu margen.",
                      }}
                    />
                  </p>
                  <p className="text-base font-bold text-slate-800">{formatCOP(be)}</p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Simulación con {input.unidadesMes} ventas/mes y {formatCOP(fixedCostPerUnit(input))} de costos fijos
                por unidad. La suma de los porcentajes da el precio. {breakdown.utilidadPesos > 0
                  ? `Utilidad de este producto: ${formatCOP(Math.round(breakdown.utilidadPesos))} por unidad.`
                  : "El precio sugerido no cubre la utilidad objetivo; revisa tus costos."}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se pudo calcular: la utilidad objetivo más la comisión se llevan más del 95%
              del precio. Ajusta esos valores en Datos del negocio.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              disabled={applying === product.id || isPending || (breakdown?.precio ?? 0) <= 0}
              onClick={() => onApply(product)}
            >
              {applying === product.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Aplicar precio sugerido ({breakdown && breakdown.precio > 0 ? formatCOP(breakdown.precio) : "—"})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}