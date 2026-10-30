"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Máximo de filas visibles en las tablas del panel. */
export const PAGE_SIZE = 10;

export interface Pager<T> {
  page: number;
  pages: number;
  setPage: (page: number) => void;
  visible: T[];
  /** Posición (base 0) de la primera fila visible dentro de la lista completa. */
  offset: number;
  from: number;
  to: number;
  total: number;
}

/** Paginación local de una lista: devuelve la página visible y su estado. */
export function usePagination<T>(items: T[], pageSize = PAGE_SIZE): Pager<T> {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  // Si un filtro reduce los resultados, se vuelve a una página válida.
  const current = Math.min(page, pages - 1);
  const offset = current * pageSize;
  return {
    page: current,
    pages,
    setPage,
    visible: items.slice(offset, offset + pageSize),
    offset,
    from: items.length === 0 ? 0 : offset + 1,
    to: Math.min(items.length, offset + pageSize),
    total: items.length,
  };
}

/** Flechas de página; no se muestra si todo cabe en una página. */
export function TablePagination<T>({ pager }: { pager: Pager<T> }) {
  const { page, pages, from, to, total, setPage } = pager;
  if (pages <= 1) return null;

  return (
    <nav aria-label="Paginación" className="mt-3 flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-14 text-center text-xs tabular-nums text-muted-foreground">
          {page + 1} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPage(page + 1)}
          disabled={page >= pages - 1}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
