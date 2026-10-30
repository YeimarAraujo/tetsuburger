"use client";

import { usePathname } from "next/navigation";
import {
  ADMIN_SECTIONS,
  type AdminSectionKey,
} from "@/config/admin-nav";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";

const SECTION_KEYS = Object.keys(ADMIN_SECTIONS) as AdminSectionKey[];

export function AdminSectionNavAuto({
  exclude = [],
}: {
  exclude?: string[];
} = {}) {
  const pathname = usePathname();

  if (exclude.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  const section = SECTION_KEYS.find((key) =>
    ADMIN_SECTIONS[key].some(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
  );

  if (!section) return null;

  return (
    <div className="border-b bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-2 lg:px-6">
        <AdminSectionNav section={section} />
      </div>
    </div>
  );
}
