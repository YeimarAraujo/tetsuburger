"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Package,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/productos", label: "Productos", icon: UtensilsCrossed },
  { href: "/admin/adicionales", label: "Adicionales", icon: Plus },
  { href: "/admin/categorias", label: "Categorías", icon: Tags },
  { href: "/admin/horarios", label: "Horarios", icon: Clock },
  { href: "/admin/gastos", label: "Gastos", icon: ReceiptText },
  { href: "/admin/produccion", label: "Compras", icon: ChefHat },
  { href: "/admin/inventario", label: "Inventario", icon: Package },
  { href: "/admin/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/admin/cierres", label: "Cierres diarios", icon: CalendarCheck },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
  { href: "/admin/auditoria", label: "Auditoría", icon: ShieldCheck },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
