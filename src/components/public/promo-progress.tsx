"use client";

import type { ReactNode } from "react";
import { Gift, Truck } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  promoTracks,
  type PromoDeliveryType,
  type PromoTrack,
  type PublicPromotion,
} from "@/lib/promotions";

interface PromoProps {
  promos: PublicPromotion[];
  subtotal: number;
  /** Si ya se eligió "Pasar a recoger", no se muestra el domicilio gratis. */
  deliveryType?: PromoDeliveryType;
  /** Versión discreta para el panel lateral del carrito. */
  compact?: boolean;
}

const money = (amount: number): ReactNode => (
  <strong className="font-extrabold text-price">{formatCOP(amount)}</strong>
);

/**
 * Mensaje corto de cada pista. El regalo es sorpresa (nunca dice cuál) y es
 * uno solo por pedido: el de mayor monto reemplaza al anterior.
 */
function trackMessage(track: PromoTrack): ReactNode {
  if (track.kind === "gift") {
    if (!track.unlocked && track.next) {
      return <>Te faltan {money(track.next.remaining)} para tu regalo sorpresa</>;
    }
    if (track.unlocked && track.next) {
      return (
        <>
          ¡Tienes un regalo sorpresa! Suma {money(track.next.remaining)} y lo
          cambiamos por uno mejor
        </>
      );
    }
    return track.hasTiers
      ? "¡Tienes el mejor regalo sorpresa!"
      : "¡Tienes un regalo sorpresa!";
  }

  if (!track.unlocked && track.next) {
    return <>Te faltan {money(track.next.remaining)} para domicilio gratis</>;
  }
  return "¡Tienes domicilio gratis!";
}

/** Versión cortísima para el botón flotante del carrito. */
function trackShortMessage(track: PromoTrack): string | null {
  if (!track.next) return null;

  if (track.kind === "gift") {
    return track.unlocked
      ? `Con ${formatCOP(track.next.remaining)} más, un regalo mejor`
      : `Faltan ${formatCOP(track.next.remaining)} para tu regalo`;
  }
  return `Faltan ${formatCOP(track.next.remaining)} para domicilio gratis`;
}

function TrackIcon({ track, small }: { track: PromoTrack; small?: boolean }) {
  const Icon = track.kind === "gift" ? Gift : Truck;
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "shrink-0",
        small ? "size-3.5" : "size-4",
        track.unlocked ? "text-emerald-600" : "text-price"
      )}
    />
  );
}

/** Tarjeta de UN beneficio: mensaje corto y, si falta algo, su barra. */
function TrackCard({
  kind,
  promos,
  subtotal,
  deliveryType,
  compact = false,
}: PromoProps & { kind: PromoTrack["kind"] }) {
  const track = promoTracks(promos, subtotal, deliveryType).find(
    (t) => t.kind === kind
  );
  if (!track) return null;

  const percent = track.next
    ? Math.min(
        100,
        Math.max(0, Math.round((subtotal / track.next.minTotal) * 100))
      )
    : 100;

  return (
    <div
      className={cn(
        "rounded-xl border",
        compact
          ? "space-y-1 border-primary/15 bg-primary/3 px-2.5 py-2 text-xs"
          : "space-y-1.5 border-primary/20 bg-primary/5 px-3 py-2.5 text-sm"
      )}
    >
      <p className="flex items-start gap-2">
        <span className="mt-px">
          <TrackIcon track={track} small={compact} />
        </span>
        <span>{trackMessage(track)}</span>
      </p>
      {track.next ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={
            kind === "gift"
              ? "Progreso hacia el regalo"
              : "Progreso hacia el domicilio gratis"
          }
          className={cn(
            "overflow-hidden rounded-full bg-primary/15",
            compact ? "h-1" : "h-1.5"
          )}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {kind === "gift" && track.unlocked && !compact ? (
        <p className="text-[11px] text-muted-foreground">Sujeto a existencias.</p>
      ) : null}
    </div>
  );
}

/** Progreso hacia el regalo sorpresa (va arriba de los productos). */
export function PromoGiftProgress(props: PromoProps) {
  return <TrackCard {...props} kind="gift" />;
}

/** Progreso hacia el domicilio gratis (va junto a los totales). */
export function PromoDeliveryProgress(props: PromoProps) {
  return <TrackCard {...props} kind="delivery" />;
}

/**
 * Versión mínima para el botón flotante: UNA sola línea con la meta más
 * cercana. El detalle de regalo y domicilio está en el panel del carrito.
 * Si ya está todo ganado, una línea de confirmación.
 */
export function PromoPill({ promos, subtotal }: Omit<PromoProps, "deliveryType">) {
  const tracks = promoTracks(promos, subtotal);
  if (tracks.length === 0) return null;

  // `w-0 min-w-full`: iguala el ancho del botón sin ensancharlo; el texto se
  // ajusta dentro.
  const pillClass =
    "pointer-events-none flex w-0 min-w-full items-center justify-center gap-1.5 rounded-full border bg-background/95 px-3 py-1 text-center text-[11px] font-semibold leading-tight text-foreground shadow-sm";

  const nearest = tracks
    .filter((t) => t.next)
    .sort((a, b) => (a.next?.remaining ?? 0) - (b.next?.remaining ?? 0))[0];

  if (!nearest) {
    return (
      <p className={pillClass}>
        <Gift className="size-3 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>
          {tracks.some((t) => t.kind === "delivery")
            ? "Regalo sorpresa y domicilio gratis"
            : "Tienes un regalo sorpresa"}
        </span>
      </p>
    );
  }

  return (
    <p className={pillClass}>
      <TrackIcon track={nearest} small />
      <span>{trackShortMessage(nearest)}</span>
    </p>
  );
}
