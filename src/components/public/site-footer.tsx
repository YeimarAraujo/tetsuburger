import Link from "next/link";
import { Camera, Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import { site } from "@/config/site";
import { whatsappContactUrl } from "@/lib/whatsapp";
import { formatHoursSummary, getPublicHours } from "@/lib/public-hours";

export async function SiteFooter() {
  const hours = formatHoursSummary(await getPublicHours());

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="font-display text-xl tracking-wide">{site.name}</p>
            <p className="text-sm text-muted-foreground">
              {site.deliveryOnly
                ? `Solo domicilios en ${site.city}, ${site.region}`
                : site.serviceArea}
            </p>
            {hours ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Horario: {hours}</span>
              </p>
            ) : null}
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{site.serviceArea}</span>
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <h2 className="font-semibold">Contacto</h2>
            <a
              href={whatsappContactUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
              WhatsApp {site.phone}
            </a>
            <a
              href={`mailto:${site.email}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              {site.email}
            </a>
            {site.social.instagram ? (
              <a
                href={site.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Camera className="size-4 shrink-0" aria-hidden="true" />
                Instagram
              </a>
            ) : null}
            <Link href="/pqr" className="block text-muted-foreground hover:text-foreground">
              PQR y derechos del titular
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <h2 className="font-semibold">Legal</h2>
            <Link href="/privacidad" className="block text-muted-foreground hover:text-foreground">
              Política de tratamiento de datos
            </Link>
            <Link href="/terminos" className="block text-muted-foreground hover:text-foreground">
              Términos y condiciones
            </Link>
            <Link href="/cookies" className="block text-muted-foreground hover:text-foreground">
              Política de cookies
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-1 border-t pt-6 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {site.name}. Todos los derechos reservados.
          </p>
          {site.taxId ? <p>NIT: {site.taxId}</p> : null}
          {site.publicAddress ? <p>{site.publicAddress}</p> : null}
        </div>
      </div>
    </footer>
  );
}
