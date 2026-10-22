import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { whatsappContactUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <Link href="/" aria-label="Ir al inicio">
        <Logo className="h-16 w-auto" />
      </Link>

      <Image
        src="/images/tetsu_404.webp"
        alt=""
        width={320}
        height={320}
        priority
        className="mt-8 h-auto w-full max-w-72"
      />

      <p className="mt-6 text-sm font-bold uppercase tracking-widest text-price">
        Error 404
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Esta página no existe
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Puede que el enlace esté mal escrito o que el producto ya no esté
        disponible. Vuelve al menú para seguir pidiendo.
      </p>

      <div className="mt-7 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-11 gap-2">
          <Link href="/#menu">
            <Home className="size-4" />
            Ver el menú
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 gap-2">
          <a
            href={whatsappContactUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" />
            Escríbenos por WhatsApp
          </a>
        </Button>
      </div>
    </main>
  );
}
