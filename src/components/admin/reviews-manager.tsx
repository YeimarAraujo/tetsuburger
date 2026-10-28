"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StarDisplay } from "@/components/ui/star-rating";
import {
  deleteReview,
  setReviewStatus,
} from "@/features/reviews/actions";
import type { ReviewStatus } from "@/types/db";

export interface AdminReview {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  comment: string | null;
  customerName: string;
  orderId: string | null;
  status: ReviewStatus;
  createdAt: string;
}

type Filter = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "TODAS";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "APROBADO", label: "Aprobadas" },
  { value: "RECHAZADO", label: "Rechazadas" },
  { value: "TODAS", label: "Todas" },
];

export function ReviewsManager({ reviews }: { reviews: AdminReview[] }) {
  // Cambios locales sobre las props (se descartan al llegar props nuevas).
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ReviewStatus>
  >({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("PENDIENTE");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminReview | null>(null);

  const rows = useMemo(
    () =>
      reviews
        .filter((r) => !deletedIds.has(r.id))
        .map((r) =>
          statusOverrides[r.id] ? { ...r, status: statusOverrides[r.id] } : r
        ),
    [reviews, statusOverrides, deletedIds]
  );

  const counts = useMemo(
    () => ({
      PENDIENTE: rows.filter((r) => r.status === "PENDIENTE").length,
      APROBADO: rows.filter((r) => r.status === "APROBADO").length,
      RECHAZADO: rows.filter((r) => r.status === "RECHAZADO").length,
      TODAS: rows.length,
    }),
    [rows]
  );

  const approved = rows.filter((r) => r.status === "APROBADO");
  const globalAvg =
    approved.length > 0
      ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
      : 0;

  const byProduct = useMemo(() => {
    const map = new Map<
      string,
      { name: string; approved: number; sum: number; total: number }
    >();
    for (const r of rows) {
      const cur = map.get(r.productId) ?? {
        name: r.productName,
        approved: 0,
        sum: 0,
        total: 0,
      };
      cur.total += 1;
      if (r.status === "APROBADO") {
        cur.approved += 1;
        cur.sum += r.rating;
      }
      map.set(r.productId, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const visible =
    filter === "TODAS" ? rows : rows.filter((r) => r.status === filter);

  async function changeStatus(review: AdminReview, status: ReviewStatus) {
    setBusyId(review.id);
    const res = await setReviewStatus(review.id, status);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setStatusOverrides((prev) => ({ ...prev, [review.id]: status }));
    toast.success(
      status === "APROBADO"
        ? "Reseña aprobada"
        : status === "RECHAZADO"
          ? "Reseña rechazada"
          : "Reseña devuelta a revisión"
    );
  }

  /** Abre el diálogo de confirmación de borrado. */
  function requestRemove(review: AdminReview) {
    setPendingDelete(review);
  }

  /** Elimina la reseña confirmada (funciona también con reseñas publicadas). */
  async function confirmRemove() {
    if (!pendingDelete) return;
    const review = pendingDelete;
    setPendingDelete(null);
    setBusyId(review.id);
    const res = await deleteReview(review.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setDeletedIds((prev) => new Set(prev).add(review.id));
    toast.success("Reseña eliminada");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendientes de revisión</p>
            <p className="text-3xl font-extrabold">{counts.PENDIENTE}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Aprobadas</p>
            <p className="text-3xl font-extrabold">{counts.APROBADO}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Promedio (aprobadas)</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-extrabold">
                {approved.length > 0 ? globalAvg.toFixed(1) : "—"}
              </p>
              {approved.length > 0 ? (
                <StarDisplay value={globalAvg} size="size-5" />
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:border-primary hover:text-primary"
            )}
          >
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No hay reseñas con este filtro.
          </div>
        ) : (
          visible.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarDisplay value={r.rating} />
                    <span className="text-sm font-semibold">{r.rating}/5</span>
                    <span className="text-sm font-medium">{r.customerName}</span>
                    {r.orderId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <ShieldCheck className="size-3" />
                        Compra verificada
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "APROBADO"
                          ? "bg-emerald-100 text-emerald-700"
                          : r.status === "RECHAZADO"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {r.status === "APROBADO"
                        ? "Aprobada"
                        : r.status === "RECHAZADO"
                          ? "Rechazada"
                          : "Pendiente"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {r.productName}
                  </p>
                  {r.comment ? (
                    <p className="max-w-2xl text-sm leading-relaxed">
                      {r.comment}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {busyId === r.id ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {r.status !== "APROBADO" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 hover:bg-emerald-50"
                          onClick={() => changeStatus(r, "APROBADO")}
                        >
                          <CheckCircle2 className="size-4" />
                          Aprobar
                        </Button>
                      ) : null}
                      {r.status !== "RECHAZADO" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => changeStatus(r, "RECHAZADO")}
                        >
                          <XCircle className="size-4" />
                          Rechazar
                        </Button>
                      ) : null}
                      {r.status !== "PENDIENTE" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => changeStatus(r, "PENDIENTE")}
                          title="Devolver a revisión"
                        >
                          Revisar
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => requestRemove(r)}
                        aria-label={`Eliminar reseña de ${r.customerName}`}
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {byProduct.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen por producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-semibold">Producto</th>
                    <th className="py-2 pr-4 font-semibold">Promedio</th>
                    <th className="py-2 pr-4 font-semibold">Aprobadas</th>
                    <th className="py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map((p) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4">
                        {p.approved > 0 ? (
                          <span className="inline-flex items-center gap-2">
                            {p.sum / p.approved > 0
                              ? (p.sum / p.approved).toFixed(1)
                              : "—"}
                            <StarDisplay value={p.sum / p.approved} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{p.approved}</td>
                      <td className="py-2">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta reseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará de forma permanente y dejará de verse en el menú,
              incluso si ya estaba publicada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDelete ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StarDisplay value={pendingDelete.rating} />
                <span className="font-semibold">{pendingDelete.customerName}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    pendingDelete.status === "APROBADO"
                      ? "bg-emerald-100 text-emerald-700"
                      : pendingDelete.status === "RECHAZADO"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  )}
                >
                  {pendingDelete.status === "APROBADO"
                    ? "Publicada"
                    : pendingDelete.status === "RECHAZADO"
                      ? "Rechazada"
                      : "Pendiente"}
                </span>
              </div>
              <p className="font-medium text-muted-foreground">
                {pendingDelete.productName}
              </p>
              {pendingDelete.comment ? (
                <p className="line-clamp-4 leading-relaxed">
                  {pendingDelete.comment}
                </p>
              ) : null}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmRemove}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
