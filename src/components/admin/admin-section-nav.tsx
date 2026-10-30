"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, type AdminSectionKey } from "@/config/admin-nav";
import { cn } from "@/lib/utils";

export function AdminSectionNav({ section }: { section: AdminSectionKey }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1"
    >
      {ADMIN_SECTIONS[section].map((item, index) => {
        const active = pathname === item.href;

        return (
          <Link
            key={`${section}-${index}`}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "text-orange-500 bg-orange-500/5 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-orange-500"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
