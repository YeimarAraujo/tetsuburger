"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
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
import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-left">
            <span className="text-lg font-extrabold tracking-tight">
              TETSU<span className="text-primary">BURGER</span>
            </span>
            <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              Admin
            </span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
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

        <div className="border-t p-3">
          <form action={signOutAction}>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              type="submit"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
