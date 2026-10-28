"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import {
  ADMIN_NAV,
  isAdminNavItemActive,
  type AdminBadges,
} from "@/config/admin-nav";
import { AdminNavBadge } from "@/components/admin/admin-nav-badge";
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

export function MobileNav({ badges }: { badges: AdminBadges }) {
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
            <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              Admin
            </span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {ADMIN_NAV.map((item) => {
            const active = isAdminNavItemActive(item, pathname);
            const Icon = item.icon;
            const badgeCount = item.badge ? badges[item.badge] : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
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
