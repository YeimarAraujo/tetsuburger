import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

export type AdminBadgeKey = "reviews" | "pqr" | "lowStock";

export interface AdminBadges {
  reviews: number;
  pqr: number;
  lowStock: number;
}

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: AdminBadgeKey;
  section?: AdminSectionKey;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  {
    href: "/admin/productos",
    label: "Productos",
    icon: UtensilsCrossed,
    badge: "reviews",
    section: "productos",
  },
  {
    href: "/admin/inventario",
    label: "Inventario",
    icon: Package,
    badge: "lowStock",
    section: "inventario",
  },
  {
    href: "/admin/finanzas",
    label: "Finanzas",
    icon: Wallet,
    section: "finanzas",
  },
  {
    href: "/admin/configuracion",
    label: "Configuración",
    icon: Settings,
    badge: "pqr",
    section: "configuracion",
  },
];

export type AdminSectionKey =
  | "productos"
  | "inventario"
  | "finanzas"
  | "configuracion";

export function isAdminNavItemActive(
  item: AdminNavItem,
  pathname: string
): boolean {
  if (item.exact) return pathname === item.href;
  if (item.section) {
    return ADMIN_SECTIONS[item.section].some(
      (link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
    );
  }
  return pathname.startsWith(item.href);
}

export const ADMIN_SECTIONS: Record<
  AdminSectionKey,
  { href: string; label: string }[]
> = {
  productos: [
    { href: "/admin/productos", label: "Productos" },
    { href: "/admin/adicionales", label: "Adicionales" },
    { href: "/admin/categorias", label: "Categorías" },
    { href: "/admin/resenas", label: "Reseñas" },
    { href: "/admin/rentabilidad", label: "Rentabilidad" },
  ],
  inventario: [
    { href: "/admin/inventario", label: "Stock" },
    { href: "/admin/produccion", label: "Compras del día" },
  ],
  finanzas: [
    { href: "/admin/finanzas", label: "Resumen" },
    { href: "/admin/gastos", label: "Gastos" },
    { href: "/admin/caja", label: "Caja y pagos" },
    { href: "/admin/cierres", label: "Cierres" },
    { href: "/admin/reportes", label: "Reportes" },
  ],
  configuracion: [
    { href: "/admin/configuracion", label: "Negocio" },
    { href: "/admin/horarios", label: "Horarios" },
    { href: "/admin/pqr", label: "PQR" },
    { href: "/admin/auditoria", label: "Auditoría" },
  ],
};
