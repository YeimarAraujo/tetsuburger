"use client";

import { useEffect, useState } from "react";
import { Store, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

function getTimeRemaining(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold tabular-nums text-primary-foreground">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        {label}
      </span>
    </div>
  );
}

export function ClosedOverlay({
  message,
  nextOpensAt,
}: {
  message: string;
  nextOpensAt: string | null;
}) {
  const [visible, setVisible] = useState(true);
  const [remaining, setRemaining] = useState(() =>
    nextOpensAt ? getTimeRemaining(new Date(nextOpensAt).getTime()) : null
  );

  useEffect(() => {
    if (!nextOpensAt || !visible) return;
    const targetMs = new Date(nextOpensAt).getTime();

    function tick() {
      setRemaining(getTimeRemaining(targetMs));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextOpensAt, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-primary/20 bg-zinc-900 p-8 text-center shadow-2xl">
        {/* Icono */}
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/15">
          <Store className="size-8 text-primary" />
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h2 className="font-display text-3xl tracking-wide text-white">
            ESTAMOS CERRADOS
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">{message}</p>
        </div>

        {/* Countdown */}
        {remaining ? (
          <div className="flex items-center gap-3">
            <Unit value={remaining.days} label="Días" />
            <span className="mt-[-18px] text-2xl font-bold text-primary">:</span>
            <Unit value={remaining.hours} label="Horas" />
            <span className="mt-[-18px] text-2xl font-bold text-primary">:</span>
            <Unit value={remaining.minutes} label="Min" />
            <span className="mt-[-18px] text-2xl font-bold text-primary">:</span>
            <Unit value={remaining.seconds} label="Seg" />
          </div>
        ) : null}

        {/* Botón */}
        <Button
          variant="outline"
          size="lg"
          className="w-full border-primary/40 bg-primary/10 font-bold text-primary hover:text-white/70 hover:bg-primary/20"
          onClick={() => setVisible(false)}
        >
          Explorar catálogo
        </Button>
      </div>
    </div>
  );
}
