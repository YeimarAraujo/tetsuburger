import Link from "next/link";
import {
  Coins,
  MessageSquareText,
  Package,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  href: string;
  label: string;
  description: string;
  icon: typeof Star;
  count?: number;
}

export function DashboardQuickActions({
  pendingReviews,
  newPqr,
  lowStock,
}: {
  pendingReviews: number;
  newPqr: number;
  lowStock: number;
}) {
  const actions: QuickAction[] = [
    {
      href: "/admin/resenas",
      label: "Reseñas pendientes",
      description: "Moderar opiniones",
      icon: Star,
      count: pendingReviews,
    },
    {
      href: "/admin/pqr",
      label: "PQR nuevas",
      description: "Responder solicitudes",
      icon: MessageSquareText,
      count: newPqr,
    },
    {
      href: "/admin/inventario",
      label: "Stock bajo",
      description: "Revisar insumos",
      icon: Package,
      count: lowStock,
    },
    {
      href: "/admin/caja",
      label: "Caja de hoy",
      description: "Saldos y movimientos",
      icon: Coins,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        const showCount = action.count !== undefined && action.count > 0;

        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                showCount ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-semibold">
                {action.label}
                {showCount ? (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {action.count! > 99 ? "99+" : action.count}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
