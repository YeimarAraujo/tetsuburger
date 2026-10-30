"use client";

import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Etiqueta cualitativa de cada cantidad de estrellas. */
export const STAR_LABELS: Record<number, string> = {
  1: "Malo",
  2: "Regular",
  3: "Bueno",
  4: "Muy bueno",
  5: "Excelente",
};

/** Estrellas rellenas según el promedio (precisión de 0.5 estrella). */
export function StarDisplay({
  value,
  className,
  size = "size-4",
}: {
  value: number;
  className?: string;
  size?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={cn("relative inline-flex", className)}
      aria-label={`${value.toFixed(1)} de 5 estrellas`}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(size, "text-muted-foreground/50")} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        <span className="flex w-max gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(size, "fill-amber-400 text-amber-400")} />
          ))}
        </span>
      </span>
    </span>
  );
}

/**
 * Selector interactivo de 1 a 5 estrellas.
 * Implementa el patrón ARIA radiogroup: roving tabindex, navegación con
 * flechas del teclado y área táctil de 44 px por estrella.
 */
export function StarPicker({
  value,
  onChange,
  disabled,
  size = "size-7",
  showLabel = false,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: string;
  /** Muestra la etiqueta cualitativa (Malo, Regular, Bueno…). */
  showLabel?: boolean;
  /** Etiqueta personalizada que reemplaza la de las estrellas. */
  label?: string;
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover || value;
  const text = label ?? (shown ? STAR_LABELS[shown] : "");

  function focusStar(n: number) {
    buttonsRef.current[n - 1]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    let next = value;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = value >= 5 ? 5 : value + 1;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = value <= 1 ? 1 : value - 1;
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 5;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(next);
    focusStar(next);
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="radiogroup"
        aria-label="Calificación"
        className="flex gap-1"
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => {
              buttonsRef.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}${
              STAR_LABELS[n] ? ` — ${STAR_LABELS[n]}` : ""
            }`}
            tabIndex={value === 0 ? (n === 1 ? 0 : -1) : value === n ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            className="grid size-11 place-items-center rounded-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50"
          >
            <Star
              className={cn(
                size,
                n <= shown
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/50"
              )}
            />
          </button>
        ))}
      </div>

      {showLabel ? (
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {text || "Elige una cantidad de estrellas"}
        </p>
      ) : null}
    </div>
  );
}
