"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_NAV,
  isAdminNavItemActive,
  type AdminBadges,
} from "@/config/admin-nav";
import { AdminNavBadge } from "@/components/admin/admin-nav-badge";
import { cn } from "@/lib/utils";

export function SidebarNav({ badges }: { badges: AdminBadges }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-3">
      {ADMIN_NAV.map((item) => {
        const active = isAdminNavItemActive(item, pathname);
        const Icon = item.icon;
        const badgeCount = item.badge ? badges[item.badge] : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
            <AdminNavBadge count={badgeCount} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
