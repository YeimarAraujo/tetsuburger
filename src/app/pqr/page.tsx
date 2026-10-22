import type { Metadata } from "next";
import { Header } from "@/components/public/header";
import { SiteFooter } from "@/components/public/site-footer";
import { PqrForm } from "@/components/public/pqr-form";

export const metadata: Metadata = {
  title: "PQR y derechos del titular",
  description:
    "Envía una petición, queja o reclamo a TETSUBURGER o ejerce tus derechos sobre datos personales.",
  alternates: { canonical: "/pqr" },
};

export default function PqrPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">PQR y derechos del titular</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escríbenos si tuviste un problema con un pedido, quieres ejercer tus
          derechos sobre datos personales o necesitas información del servicio.
        </p>
        <div className="mt-6">
          <PqrForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
