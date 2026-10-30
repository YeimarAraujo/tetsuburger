"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarDisplay, StarPicker } from "@/components/ui/star-rating";
import {
  getProductReviews,
  submitProductReview,
  type PublicReview,
  type ReviewSort,
} from "@/features/reviews/actions";

const PAGE_SIZE = 20;
const MAX_COMMENT = 1000;

const SORT_LABELS: { value: ReviewSort; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "high", label: "Mejor primero" },
  { value: "low", label: "Peor primero" },
];

interface TriggerProps {
  productId: string;
  productName: string;
  rating?: { avg: number; count: number } | null;
  /**
   * "card" = línea de estrellas + promedio en la tarjeta ·
   * "button" = botón con borde (en el diálogo de adiciones) ·
   * "cta" = botón "Calificar" junto al botón Agregar.
   */
  variant?: "card" | "button" | "cta";
  className?: string;
  /**
   * Modo controlado: si se pasa `onOpenChange`, el padre es dueño del estado
   * de apertura y el componente se limita a notificar los cambios.
   */
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  /** No renderiza el botón (solo el diálogo). Útil en modo controlado. */
  hideTrigger?: boolean;
}

type Step = "list" | "form";

interface Summary {
  avg: number;
  count: number;
  distribution: Record<number, number>;
}

const EMPTY_SUMMARY: Summary = {
  avg: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/**
 * Modal de reseñas de un producto.
 * Estructura en 3 zonas: encabezado fijo (resumen + distribución), cuerpo con
 * scroll propio (orden, filtro y lista) y pie fijo con una única acción
 * primaria. El formulario de envío es un segundo paso, nunca queda enterrado
 * bajo la lista.
 */
export function ReviewsTrigger({
  productId,
  productName,
  rating,
  variant = "card",
  className,
  onOpenChange,
  open: controlledOpen,
  hideTrigger,
}: TriggerProps) {
  const isControlled = typeof onOpenChange === "function";
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [step, setStep] = useState<Step>("list");
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<ReviewSort>("recent");

  const [name, setName] = useState("");
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const uid = useId();
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const starGroupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Expone el viewport visible (altura real y desplazamiento) como variables
   * CSS para que el bottom sheet no quede detrás del teclado en móvil.
   */
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const visibleBottom = vv.offsetTop + vv.height;
      const shift = Math.max(0, window.innerHeight - visibleBottom);
      const root = document.documentElement;
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvshift", `${shift}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      const root = document.documentElement;
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvshift");
    };
  }, [open]);

  /** Carga una página de reseñas (filtro + orden se aplican en el servidor). */
  const fetchPage = useCallback(
    (offset: number, append: boolean) => {
      const requestId = ++requestRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);

      return getProductReviews(productId, {
        rating: ratingFilter,
        sort,
        limit: PAGE_SIZE,
        offset,
      })
        .then((res) => {
          if (!mountedRef.current || requestId !== requestRef.current) return;
          setSummary({
            avg: res.avg,
            count: res.count,
            distribution: res.distribution,
          });
          setReviews((prev) =>
            append ? [...prev, ...res.reviews] : res.reviews
          );
          setHasMore(res.hasMore);
        })
        .catch((err) => {
          console.error("getProductReviews error", err);
          if (!mountedRef.current || requestId !== requestRef.current) return;
          setReviews([]);
          setSummary(EMPTY_SUMMARY);
          setHasMore(false);
        })
        .finally(() => {
          if (!mountedRef.current || requestId !== requestRef.current) return;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [productId, ratingFilter, sort]
  );

  /** Al abrir (o al cambiar filtro/orden) se recarga la lista. */
  useEffect(() => {
    if (!open) return;
    // Se aplaza un frame para no encadenar renders al abrir el modal.
    const frame = requestAnimationFrame(() => {
      fetchPage(0, false);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, fetchPage]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setOpen(false);
      setStep("list");
      setSent(false);
      return;
    }
    setOpen(true);
  }

  function toggleRatingFilter(value: number) {
    setRatingFilter((prev) => (prev === value ? null : value));
  }

  function loadMore() {
    if (loadingMore || loading) return;
    void fetchPage(reviews.length, true);
  }

  function openForm() {
    setStep("form");
    setSent(false);
    // Enfoca el grupo de estrellas (sin abrir el teclado en móvil).
    window.requestAnimationFrame(() => {
      starGroupRef.current
        ?.querySelector<HTMLButtonElement>('[role="radio"]')
        ?.focus();
    });
  }

  async function submit() {
    if (stars < 1) {
      toast.error("Elige de 1 a 5 estrellas");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Ingresa tu nombre");
      return;
    }
    if (!accepted) {
      toast.error("Acepta los términos y la política de privacidad");
      return;
    }
    setSending(true);
    try {
      const res = await submitProductReview({
        productId,
        rating: stars,
        comment,
        customerName: name.trim(),
        token: "",
        acceptedTerms: accepted,
        website,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("¡Gracias! Tu reseña está pendiente de aprobación.");
      track("review_submitted", { product: productName, rating: stars });
      setSent(true);
      setStars(0);
      setComment("");
    } catch (err) {
      console.error("submitProductReview client error", err);
      toast.error("No se pudo enviar la reseña. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  const count = rating?.count ?? 0;
  const hasRating = count > 0;
  const maxDistribution = Math.max(
    1,
    ...Object.values(summary.distribution)
  );

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenChange(true);
          }}
          className={cn(
            "flex items-center text-left",
            variant === "cta"
              ? "gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
              : variant === "button"
                ? "gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                : "mt-1 gap-1 text-xs text-muted-foreground",
            className
          )}
          aria-label={
            variant === "cta"
              ? `Calificar ${productName}`
              : hasRating
                ? `Ver reseñas de ${productName}: ${rating!.avg.toFixed(1)} de 5, ${count} ${count === 1 ? "reseña" : "reseñas"}`
                : `Ver reseñas de ${productName}: sé el primero en calificar`
          }
        >
          {variant === "cta" ? (
            <>
              <Star className="size-4 fill-amber-400 text-amber-400" />
              Calificar
            </>
          ) : hasRating ? (
            <>
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground">
                {rating!.avg.toFixed(1)}
              </span>
              <span>
                ({count} {count === 1 ? "reseña" : "reseñas"})
              </span>
            </>
          ) : (
            <>
              <MessageSquareText className="size-3.5" />
              <span>Sé el primero en calificar</span>
            </>
          )}
        </button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          // Sin autofocus: Radix enfocaba el input de nombre y abría el teclado.
          onOpenAutoFocus={(e) => e.preventDefault()}
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-y-hidden overflow-x-hidden rounded-none p-0"
          className={cn(
            "flex max-h-none flex-col overflow-hidden p-0",
            // Móvil: bottom sheet (~92 % del viewport visible) que sube con el teclado.
            "h-[calc(var(--vvh,100dvh)*0.92)] translate-y-[calc(var(--vvshift,0px)*-1)]",
            "bottom-0 left-0 right-0 top-auto max-w-none translate-x-0 rounded-b-none rounded-t-2xl",
            // Escritorio: modal centrado con alto acotado.
            "sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:h-[85vh] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl"
          )}
        >
          {/* Zona 1 · encabezado fijo */}
          <header className="shrink-0 space-y-3 border-b px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                {step === "form" ? (
                  <button
                    type="button"
                    onClick={() => setStep("list")}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                    Volver a las reseñas
                  </button>
                ) : null}
                <DialogTitle className="truncate text-base font-semibold">
                  {productName}
                </DialogTitle>
              </div>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="Cerrar reseñas"
                >
                  <X className="size-5" />
                </Button>
              </DialogClose>
            </div>

            {step === "list" ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-extrabold leading-none tabular-nums">
                    {summary.count > 0 ? summary.avg.toFixed(1) : "—"}
                  </span>
                  <div className="space-y-1">
                    {summary.count > 0 ? (
                      <StarDisplay value={summary.avg} size="size-4" />
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {summary.count}{" "}
                      {summary.count === 1 ? "reseña" : "reseñas"}
                    </p>
                  </div>
                </div>

                {summary.count > 0 ? (
                  <div className="space-y-0.5">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const amount = summary.distribution[n] ?? 0;
                      const pct = (amount / maxDistribution) * 100;
                      const active = ratingFilter === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleRatingFilter(n)}
                          aria-pressed={active}
                          aria-label={`Filtrar por ${n} ${n === 1 ? "estrella" : "estrellas"}`}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted",
                            active && "bg-muted/70 ring-1 ring-primary/50"
                          )}
                        >
                          <span className="w-9 shrink-0 text-left tabular-nums text-muted-foreground">
                            {n} ★
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-amber-400"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                            {amount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
          </header>

          {/* Zona 2 · cuerpo con scroll propio */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {step === "list" ? (
              <div className="space-y-3">
                <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b bg-popover/95 px-4 py-2 backdrop-blur">
                  <Select
                    value={sort}
                    onValueChange={(v) => setSort(v as ReviewSort)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-9"
                      aria-label="Ordenar reseñas"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_LABELS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {ratingFilter !== null ? (
                    <button
                      type="button"
                      onClick={() => setRatingFilter(null)}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Solo {ratingFilter} ★
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {reviews.length} de {summary.count}
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-3" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {ratingFilter !== null
                      ? `No hay reseñas de ${ratingFilter} estrellas.`
                      : "Aún no hay reseñas. ¡Sé la primera persona en calificar!"}
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {reviews.map((r) => (
                      <li key={r.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {r.customer_name}
                            </span>
                            {r.verified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                <ShieldCheck className="size-3" />
                                Compra verificada
                              </span>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(r.created_at)}
                          </span>
                        </div>
                        <StarDisplay value={r.rating} />
                        {r.comment ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {r.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {hasMore ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Cargar más reseñas
                  </Button>
                ) : null}
              </div>
            ) : sent ? (
              <div className="space-y-3">
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  ¡Gracias! Tu reseña quedó enviada y aparecerá en el menú cuando
                  el equipo la revise.
                </p>
                <Button variant="outline" className="w-full" onClick={openForm}>
                  Escribir otra reseña
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    ¿Qué te pareció este producto?
                  </p>
                  <div ref={starGroupRef}>
                    <StarPicker
                      value={stars}
                      onChange={setStars}
                      showLabel
                      size="size-8"
                      disabled={sending}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Elige de 1 a 5 estrellas. La calificación es obligatoria.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <label
                      htmlFor={`${uid}-comment`}
                      className="text-sm font-semibold"
                    >
                      Comentario{" "}
                      <span className="font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {comment.length}/{MAX_COMMENT}
                    </span>
                  </div>
                  <Textarea
                    id={`${uid}-comment`}
                    placeholder="Cuéntanos tu experiencia con este producto"
                    rows={4}
                    maxLength={MAX_COMMENT}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={sending}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={`${uid}-name`} className="text-sm font-semibold">
                    Tu nombre
                  </label>
                  <Input
                    id={`${uid}-name`}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={sending}
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-input"
                  />
                  <span>
                    Acepto los{" "}
                    <Link href="/terminos" className="underline underline-offset-2">
                      términos
                    </Link>{" "}
                    y la{" "}
                    <Link href="/privacidad" className="underline underline-offset-2">
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>

                {/* Honeypot anti-spam */}
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />

                <p className="text-xs text-muted-foreground">
                  Tu reseña se publica tras una breve revisión.
                </p>
              </div>
            )}
          </div>

          {/* Zona 3 · pie fijo con una única acción primaria */}
          <footer className="shrink-0 border-t bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {step === "list" ? (
              <Button className="w-full gap-2" onClick={openForm}>
                <Star className="size-4" />
                Escribir una reseña
              </Button>
            ) : sent ? (
              <Button className="w-full" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setStep("list")}
                  disabled={sending}
                >
                  <ChevronLeft className="size-4" />
                  Volver
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={submit}
                  disabled={sending || stars === 0 || !accepted}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Star className="size-4" />
                  )}
                  Enviar reseña
                </Button>
              </div>
            )}
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}
