"use client";

import { useMemo } from "react";
import { BadgePercent } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RentabilidadRow {
  id: string;
  name: string;
  price: number;
  cost: number;
  category?: { name: string } | null;
}

// Umbrales de margen bruto (%). Configurables; no existe regla previa en el sistema.
const MARGIN_HEALTHY = 50; // >= verde
const MARGIN_WARN = 30; // >= amarillo, < verde

function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function HealthBadge({ pct }: { pct: number }) {
  if (pct >= MARGIN_HEALTHY) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600">
        {pct.toFixed(1)}%
      </Badge>
    );
  }
  if (pct >= MARGIN_WARN) {
    return (
      <Badge className="bg-amber-500/15 text-amber-600">
        {pct.toFixed(1)}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-600">
      {pct.toFixed(1)}%
    </Badge>
  );
}

export function RentabilidadManager({ products }: { products: RentabilidadRow[] }) {
  const rows = useMemo(() => {
    return products
      .map((p) => ({
        ...p,
        margin: p.price - p.cost,
        marginPct: marginPct(p.price, p.cost),
      }))
      .sort((a, b) => b.marginPct - a.marginPct);
  }, [products]);

  return (
    <Card>
      <CardContent className="overflow-x-auto py-4">
        <div className="mb-3 flex items-center gap-2">
          <BadgePercent className="size-5 text-primary" />
          <p className="text-sm font-medium">Rentabilidad de productos ({rows.length})</p>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay productos activos</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">Producto</th>
                <th className="pb-2 pr-2 font-medium">Categoría</th>
                <th className="pb-2 pr-2 text-right font-medium">Precio de venta</th>
                <th className="pb-2 pr-2 text-right font-medium">Costo</th>
                <th className="pb-2 pr-2 text-right font-medium">Margen</th>
                <th className="pb-2 text-right font-medium">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{p.name}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{p.category?.name ?? "—"}</td>
                  <td className="py-2 pr-2 text-right">{formatCOP(p.price)}</td>
                  <td className="py-2 pr-2 text-right text-muted-foreground">{formatCOP(p.cost)}</td>
                  <td className="py-2 pr-2 text-right font-semibold">{formatCOP(p.margin)}</td>
                  <td className="py-2 text-right">
                    <HealthBadge pct={p.marginPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
