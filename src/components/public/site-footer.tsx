import Link from "next/link";
import {
  Camera,
  Clock,
  MapPin,
  MessageCircleMore,
  Phone,
} from "lucide-react";
import { site } from "@/config/site";
import { whatsappContactUrl } from "@/lib/whatsapp";
import { formatHoursSummary, getPublicHours } from "@/lib/public-hours";
import { Logo } from "@/components/ui/logo";
import { ScrollToTopLink } from "@/components/ui/scroll-to-top-link";

export async function SiteFooter() {
  const hours = formatHoursSummary(await getPublicHours());
  const phone = site.phone.replace(/\s/g, "");

  const socials = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: whatsappContactUrl(),
      icon: <MessageCircleMore aria-hidden="true" />,
    },
    ...(site.social.instagram
      ? [
        {
          id: "instagram",
          label: "Instagram",
          href: site.social.instagram,
          icon: <Camera aria-hidden="true" />,
        },
      ]
      : []),
    {
      id: "phone",
      label: "Llamar",
      href: `tel:${phone}`,
      icon: <Phone aria-hidden="true" />,
    },
  ];

  return (
    <footer className="border-t border-primary/20 bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-12">
        {/* Zona superior: marca, horario, zona y redes sociales */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="space-y-5 lg:pr-12">
            <Link href="/" aria-label="Ir al inicio">
              <Logo className="h-30 w-auto" />
            </Link>

            {hours ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-foreground/70">
                <Clock className="size-4 shrink-0 text-primary" />
                <span>Horario: {hours}</span>
              </p>
            ) : null}

            <p className="mt-2 flex items-center gap-2 text-sm text-foreground/70">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span>{site.serviceArea}</span>
            </p>

            <div className="mt-5 flex items-center gap-3">
              {socials.map((social) => (
                <a
                  key={social.id}
                  href={social.href}
                  target={social.id === "phone" ? undefined : "_blank"}
                  rel={social.id === "phone" ? undefined : "noopener noreferrer"}
                  aria-label={social.label}
                  className="grid size-9 place-items-center rounded-full border border-primary/20 bg-background text-primary motion-safe:transition-all motion-reduce:transition-none hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
          {/* Navegación */}
          <div className="grid grid-cols-2 gap-8">
            <nav aria-label="Sitio">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">
                Sitio
                <span className="mt-2 block h-[3px] w-8 rounded-full bg-orange-500" />
              </h2>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/pqr"
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    PQR y sugerencias
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacidad"
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    Privacidad
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terminos"
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    Términos y condiciones
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Atención">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">
                Atención
                <span className="mt-2 block h-[3px] w-8 rounded-full bg-orange-500" />
              </h2>
              <ul className="mt-3 space-y-2">
                <li>
                  <a
                    href={whatsappContactUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${site.email}`}
                    className="break-words text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {site.email}
                  </a>
                </li>
                {site.social.instagram ? (
                  <li>
                    <a
                      href={site.social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-foreground/80 transition-colors hover:text-primary"
                    >
                      Instagram
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>

          </div>
        </div>

        {/* Pie legal */}
        <div className="mt-16 flex flex-col gap-2 border-t border-primary/10 pt-8 text-xs text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>
              © {new Date().getFullYear()} {site.name}. Todos los derechos
              reservados.
            </p>
            {site.taxId ? <p>NIT: {site.taxId}</p> : null}
            {site.publicAddress ? <p>{site.publicAddress}</p> : null}
          </div>

          <div className="flex items-center gap-4">
            <ScrollToTopLink />
          </div>
        </div>
      </div>
    </footer >
  );
}
