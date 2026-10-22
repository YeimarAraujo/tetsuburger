"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error de interfaz", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <Link href="/" aria-label="Ir al inicio">
        <Logo className="h-16 w-auto" />
      </Link>

      <p className="mt-8 text-sm font-bold uppercase tracking-widest text-price">
        Algo salió mal
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        No pudimos cargar esta página
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, escríbenos
        por WhatsApp y te ayudamos con tu pedido.
      </p>

      <div className="mt-7 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Button
          type="button"
          size="lg"
          className="h-11 gap-2"
          onClick={() => reset()}
        >
          <RotateCcw className="size-4" />
          Reintentar
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 gap-2">
          <Link href="/">
            <Home className="size-4" />
            Volver al inicio
          </Link>
        </Button>
      </div>
    </main>
  );
}
