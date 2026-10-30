"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  computeOpenStatus,
  currentMinute,
  formatHour12,
  nowInBogota,
  type HourRow,
  type OpenStatus,
} from "@/lib/business-hours";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

interface StoreStatusValue {
  status: OpenStatus;
  /** Se pueden agregar productos (abierto, o el dueño acepta pedidos fuera de horario). */
  canOrder: boolean;
  /** Minuto actual (ms) con el que se calculó el estado. */
  nowMs: number;
}

const StoreStatusContext = createContext<StoreStatusValue | null>(null);

/* Reloj por minutos: la página se cachea en el servidor (ISR), así que el
   estado se recalcula en el navegador con la hora real. */
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export function StoreStatusProvider({
  hours,
  temporarilyClosed,
  closedMessage,
  allowOutsideHours,
  renderedAtMinute,
  children,
}: {
  hours: HourRow[];
  temporarilyClosed: boolean;
  closedMessage?: string;
  allowOutsideHours: boolean;
  /** Minuto en que el servidor generó la página: se usa al hidratar. */
  renderedAtMinute: number;
  children: ReactNode;
}) {
  const minute = useSyncExternalStore(subscribeClock, currentMinute, () => renderedAtMinute);

  const value = useMemo<StoreStatusValue>(() => {
    const nowMs = minute * 60_000;
    const status = computeOpenStatus(hours, temporarilyClosed, closedMessage, new Date(nowMs));
    return {
      status,
      canOrder: status.isOpen || (allowOutsideHours && !temporarilyClosed),
      nowMs,
    };
  }, [minute, hours, temporarilyClosed, closedMessage, allowOutsideHours]);

  return <StoreStatusContext.Provider value={value}>{children}</StoreStatusContext.Provider>;
}

/** Estado del negocio, o null fuera de un StoreStatusProvider. */
export function useStoreStatus(): StoreStatusValue | null {
  return useContext(StoreStatusContext);
}

export function StoreStatusBadge() {
  const store = useStoreStatus();
  if (!store) return null;
  const open = store.status.isOpen;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white",
        open ? "bg-emerald-600" : "bg-red-600"
      )}
    >
      <span className={cn("size-2 rounded-full bg-white", open && "animate-pulse")} />
      {open ? "Abierto" : "Cerrado"}
    </span>
  );
}

/**
 * Horario de atención mientras está abierto ("Atendemos hasta las 11:00 PM").
 * Cerrado no muestra nada: ese aviso ya lo da ClosedOverlay.
 */
export function StoreStatusMessage({ className }: { className?: string }) {
  const store = useStoreStatus();
  if (!store || !store.status.isOpen) return null;
  return <p className={className}>{store.status.message}</p>;
}

const TIMEZONE = "America/Bogota";

function getTimeRemaining(diffMs: number) {
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

/** "hoy a las 5:00 PM" / "el jueves a las 5:00 PM" (hora de Colombia). */
function formatOpening(opensAt: Date, nowMs: number): string {
  const { time, dayOfWeek } = nowInBogota(opensAt);
  const isToday =
    dayOfWeek === nowInBogota(new Date(nowMs)).dayOfWeek &&
    opensAt.getTime() - nowMs < 24 * 60 * 60 * 1000;
  const day = isToday
    ? "hoy"
    : `el ${new Intl.DateTimeFormat("es-CO", { timeZone: TIMEZONE, weekday: "long" }).format(opensAt)}`;
  return `${day} a las ${formatHour12(time)}`;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span className="flex aspect-square w-full max-w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold tabular-nums text-primary-foreground sm:text-3xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return <span className="-mt-4.5 shrink-0 text-2xl font-bold text-primary">:</span>;
}

/** Modal cuando el negocio está cerrado (se puede cerrar para ver el menú). */
export function ClosedOverlay() {
  const store = useStoreStatus();
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const isClosed = !!store && !store.status.isOpen;
  const nextOpensAt = store?.status.nextOpensAt ?? null;
  const open = isClosed && !dismissed;

  useEffect(() => {
    if (!open || !nextOpensAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, nextOpensAt]);

  if (!store || !isClosed) return null;

  const { status, nowMs } = store;
  const opensAt = nextOpensAt ? new Date(nextOpensAt) : null;
  const remaining = opensAt && now !== null ? getTimeRemaining(opensAt.getTime() - now) : null;
  // Con más de un día por delante, los segundos no aportan.
  const showSeconds = remaining !== null && remaining.days === 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/75 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
        className="rounded-3xl ring-primary/20 sm:max-w-sm"
        bodyClassName="flex flex-col items-center gap-6 rounded-3xl p-6 text-center sm:p-8"
      >
        <Logo className="h-12" />

        <DialogHeader className="items-center gap-2">
          <DialogTitle className="font-display text-3xl uppercase tracking-wide">
            Estamos cerrados
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {opensAt
              ? `Nuestro horario de atención comienza ${formatOpening(opensAt, nowMs)}.`
              : status.message}
          </DialogDescription>
        </DialogHeader>

        {remaining ? (
          <div className="flex w-full items-center gap-2" aria-hidden="true">
            <Unit value={remaining.days} label="Días" />
            <Separator />
            <Unit value={remaining.hours} label="Horas" />
            <Separator />
            <Unit value={remaining.minutes} label="Min" />
            {showSeconds ? (
              <>
                <Separator />
                <Unit value={remaining.seconds} label="Seg" />
              </>
            ) : null}
          </div>
        ) : null}

        <Button size="lg" className="h-11 w-full font-bold" onClick={() => setDismissed(true)}>
          Explorar catálogo
        </Button>
      </DialogContent>
    </Dialog>
  );
}
