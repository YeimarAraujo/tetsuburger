import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappContactUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <h1 className="sr-only">Página no encontrada (error 404)</h1>

      <div className="relative w-full max-w-3xl">
        <Image
          src="/images/tetsu_404.webp"
          alt="Ilustración de página no encontrada de TETSU BURGER"
          width={1440}
          height={900}
          priority
          sizes="(max-width: 896px) 100vw, 896px"
          className="h-auto w-full"
        />

        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3 sm:bottom-5">
          <div className="flex w-full max-w-md gap-2 rounded-2xl bg-background/85 p-2 shadow-lg backdrop-blur-md sm:w-auto">
            <Button asChild size="lg" className="h-11 flex-1 gap-2 sm:flex-none">
              <Link href="/#menu">
                <Home aria-hidden="true" className="size-4" />
                Ver el menú
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-11 flex-1 gap-2 bg-white text-foreground hover:bg-white/90 sm:flex-none"
            >
              <a
                href={whatsappContactUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
