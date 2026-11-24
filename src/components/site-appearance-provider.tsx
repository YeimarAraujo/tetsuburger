"use client";

import { createContext, useContext } from "react";
import { buildSiteAppearance, type SiteAppearance } from "@/lib/seasonal-theme";

const SiteAppearanceContext = createContext<SiteAppearance | null>(null);

export function SiteAppearanceProvider({
  value,
  children,
}: {
  value: SiteAppearance;
  children: React.ReactNode;
}) {
  return (
    <SiteAppearanceContext.Provider value={value}>
      {children}
    </SiteAppearanceContext.Provider>
  );
}

/** Apariencia vigente; sin proveedor devuelve los valores por defecto. */
export function useSiteAppearance(): SiteAppearance {
  return useContext(SiteAppearanceContext) ?? buildSiteAppearance({});
}
