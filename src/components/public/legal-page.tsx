import Link from "next/link";
import { site, isLegalDraft, legalIdentityLines } from "@/config/site";
import { Header } from "@/components/public/header";
import { SiteFooter } from "@/components/public/site-footer";

interface LegalPageProps {
  title: string;
  summary: string;
  children: React.ReactNode;
}

export function LegalPage({ title, summary, children }: LegalPageProps) {
  const draft = isLegalDraft();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {draft ? (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          <strong>Borrador.</strong> Este documento se publica como borrador
          pendiente de los datos del titular. No debe considerarse la versión
          definitiva.
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <nav aria-label="Migas de pan" className="mb-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">{title}</span>
        </nav>

        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{summary}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:mt-2 [&_strong]:font-semibold [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>

        <section className="mt-10 rounded-xl border bg-card p-4 text-sm">
          <h2 className="font-bold">Identificación del prestador</h2>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Nombre comercial: {site.name}</li>
            {legalIdentityLines().map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              Correo:{" "}
              <a href={`mailto:${site.privacyEmail}`} className="text-foreground">
                {site.privacyEmail}
              </a>
            </li>
            <li>
              WhatsApp:{" "}
              <a href={`https://wa.me/${site.whatsapp}`} className="text-foreground">
                {site.phone}
              </a>
            </li>
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
