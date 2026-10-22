"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Flame, Search, Star, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCard, type ProductCardData } from "@/components/public/product-card";

export interface MenuSection {
  /** Identificador estable usado como id de la sección. */
  key: string;
  label: string;
  /** Icono opcional (solo para los filtros especiales). */
  icon?: "flame" | "trending" | "star";
  tagline?: string;
  items: ProductCardData[];
  /** Sección activa al cargar (normalmente Destacados). */
  default?: boolean;
  /** Sección "especial" (Destacados / Más pedidos / Mejor valorados). */
  special?: boolean;
}

const ICONS = {
  flame: Flame,
  trending: TrendingUp,
  star: Star,
} as const;

/**
 * Secciones ocultas (se identifican por su icono).
 * "trending" = Los más pedidos, "star" = Mejor valorados.
 * Para volver a mostrarlas, borra el icono de esta lista.
 */
const HIDDEN_ICONS: NonNullable<MenuSection["icon"]>[] = ["trending", "star"];

/** Texto buscable de un producto (name + description si existen). */
function searchText(p: ProductCardData): string {
  const r = p as unknown as Record<string, unknown>;
  return `${r.name ?? ""} ${r.description ?? ""}`.toLowerCase();
}

/**
 * Menú del home.
 *
 * Comportamiento (único y consistente):
 * - Los pills SIEMPRE son los mismos: especiales primero (con icono), un
 *   separador y luego las categorías. Nada aparece ni desaparece al navegar.
 * - El pill activo sigue al scroll (scroll-spy) y se centra solo en la barra.
 * - Buscador: filtra por categorías (las secciones especiales se ocultan
 *   mientras se busca para no duplicar resultados).
 */
export function MenuSections({ sections: allSections }: { sections: MenuSection[] }) {
  const sections = useMemo(
    () => allSections.filter((s) => !s.icon || !HIDDEN_ICONS.includes(s.icon)),
    [allSections]
  );
  const defaultSection = sections.find((s) => s.default) ?? sections[0] ?? null;

  const [activeKey, setActiveKey] = useState(() => defaultSection?.key ?? "");
  const [query, setQuery] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef(false); // evita parpadeo del scroll-spy tras un clic
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  /** Secciones visibles según la búsqueda. */
  const visible = useMemo(() => {
    if (!searching) return sections;
    return sections
      .filter((s) => !s.special)
      .map((s) => ({ ...s, items: s.items.filter((p) => searchText(p).includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [sections, searching, q]);

  const specials = visible.filter((s) => s.special);
  const normals = visible.filter((s) => !s.special);
  const totalResults = normals.reduce((acc, s) => acc + s.items.length, 0);
  const visibleKeys = visible.map((s) => s.key).join("|");

  // --- Scroll-spy ---------------------------------------------------------
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (lockRef.current) return;
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top?.target.id) setActiveKey(top.target.id);
      },
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 }
    );
    for (const key of visibleKeys.split("|")) {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visibleKeys]);

  // --- Centrar el pill activo dentro de la barra (sin mover la página) -----
  useEffect(() => {
    const nav = navRef.current;
    const pill = pillRefs.current[activeKey];
    if (!nav || !pill) return;
    const left = pill.offsetLeft - nav.clientWidth / 2 + pill.clientWidth / 2;
    nav.scrollTo({ left, behavior: "smooth" });
  }, [activeKey]);

  // --- Fades laterales de la barra + botón "volver arriba" ----------------
  const updateEdges = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    setEdges({
      left: nav.scrollLeft > 4,
      right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, visibleKeys]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  if (sections.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          El menú se está preparando, vuelve en un momento.
        </div>
      </main>
    );
  }

  function smoothBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
  }

  function goTo(key: string) {
    setActiveKey(key);
    lockRef.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockRef.current = false;
    }, 800);
    sectionRefs.current[key]?.scrollIntoView({
      behavior: smoothBehavior(),
      block: "start",
    });
  }

  function renderPill(s: MenuSection) {
    const isActive = s.key === activeKey;
    const Icon = s.icon ? ICONS[s.icon] : null;
    return (
      <button
        key={s.key}
        ref={(el) => {
          pillRefs.current[s.key] = el;
        }}
        type="button"
        onClick={() => goTo(s.key)}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "group flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium",
          "transition-all duration-200 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          isActive
            ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
            : "bg-background hover:-translate-y-px hover:border-primary hover:text-price"
        )}
      >
        {Icon ? (
          <Icon
            className={cn(
              "size-3.5 transition-transform group-hover:scale-110",
              isActive ? "text-primary-foreground" : "text-price"
            )}
          />
        ) : null}
        {s.label}
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] tabular-nums leading-4",
            isActive ? "bg-white/20" : "bg-muted text-muted-foreground"
          )}
        >
          {s.items.length}
        </span>
      </button>
    );
  }

  return (
    <>
      {/* Buscador */}
      <div className="mx-auto mt-8 max-w-5xl px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Buscar en el menú…"
            aria-label="Buscar en el menú"
            className="h-11 w-full rounded-full border bg-background pl-10 pr-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {searching ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground" aria-live="polite">
            {totalResults === 0
              ? "Sin resultados"
              : `${totalResults} ${totalResults === 1 ? "resultado" : "resultados"} para “${query.trim()}”`}
          </p>
        ) : null}
      </div>

      {/* Pills de navegación */}
      {visible.length > 0 ? (
        <nav
          aria-label="Secciones del menú"
          className="sticky top-14 z-30 mt-4 border-y bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        >
          <div className="relative mx-auto max-w-5xl">
            <div
              ref={navRef}
              onScroll={updateEdges}
              className="flex items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {specials.map(renderPill)}
              {specials.length > 0 && normals.length > 0 ? (
                <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
              ) : null}
              {normals.map(renderPill)}
            </div>
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
                edges.left ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity",
                edges.right ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        </nav>
      ) : null}

      {/* Secciones apiladas */}
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-8">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <p className="font-medium">No encontramos “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Prueba con otra palabra o revisa la ortografía.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              Ver todo el menú
            </button>
          </div>
        ) : null}

        {visible.map((s) => {
          const Icon = s.icon ? ICONS[s.icon] : null;
          return (
            <section
              key={s.key}
              id={s.key}
              ref={(el) => {
                sectionRefs.current[s.key] = el;
              }}
              aria-labelledby={`${s.key}-title`}
              className="scroll-mt-28"
            >
              <header className="mb-4">
                <div className="flex items-center gap-3">
                  {Icon ? (
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10">
                      <Icon className="size-4 text-primary" />
                    </span>
                  ) : null}
                  <h2
                    id={`${s.key}-title`}
                    className="text-xl font-bold tracking-tight sm:text-xl"
                  >
                    {s.label}
                  </h2>
                  <span aria-hidden className="h-px flex-1" />
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {s.items.length} {s.items.length === 1 ? "opción" : "opciones"}
                  </span>
                </div>
                {s.tagline ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{s.tagline}</p>
                ) : null}
              </header>

              <div className="grid gap-3 sm:grid-cols-2">
                {s.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Volver arriba */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: smoothBehavior() })}
        aria-label="Volver arriba"
        className={cn(
          "fixed bottom-5 right-20 z-40 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30",
          "transition-all duration-300 hover:-translate-y-0.5 active:scale-95",
          showTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <ArrowUp className="size-5" />
      </button>
    </>
  );
}