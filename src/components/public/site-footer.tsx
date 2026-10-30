import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { site } from "@/config/site";
import { whatsappContactUrl } from "@/lib/whatsapp";
import { formatHoursSummary, getPublicHours } from "@/lib/public-hours";
import { BurgerPattern } from "@/components/ui/burger-pattern";
import { Logo2 } from "@/components/ui/logoFooter";
import { SocialLinks } from "@/components/public/social-links";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const linkClass =
  "rounded-sm text-sm text-white/90 [overflow-wrap:anywhere] underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className={linkClass}
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function SiteFooter() {
  const hours = formatHoursSummary(await getPublicHours());
  const phone = site.phone.replace(/\s/g, "");

  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: "Pedir",
      links: [
        { label: "Ver menú", href: "/#menu" },
        { label: "Mi pedido", href: "/checkout" },
      ],
    },
    {
      title: "Ayuda",
      links: [
        { label: "WhatsApp", href: whatsappContactUrl(), external: true },
        { label: "Llamar", href: `tel:${phone}`, external: true },
        { label: site.email, href: `mailto:${site.email}`, external: true },
        { label: "PQR y sugerencias", href: "/pqr" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacidad", href: "/privacidad" },
        { label: "Términos y condiciones", href: "/terminos" },
        { label: "Cookies", href: "/cookies" },
      ],
    },
  ];

  return (
    <footer className="relative isolate overflow-hidden bg-primary text-white">
      <BurgerPattern id="footer" />

      {/* Filo de marca */}
      <div
        aria-hidden="true"
        className="h-1 bg-linear-to-r from-white/0 via-white/50 to-white/0"
      />

      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.3fr_2fr]">
          {/* Marca */}
          <div className="space-y-4">
            <Link
              href="/"
              aria-label="Ir al inicio"
              className="-ml-3 inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Logo2 className="h-16 w-auto" />
            </Link>

            <ul className="space-y-2 text-sm text-white/90">
              {hours ? (
                <li className="flex items-start gap-2">
                  <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-white" />
                  <span>{hours}</span>
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-white" />
                <span>Domicilios en {site.serviceArea}</span>
              </li>
            </ul>

            <SocialLinks className="pt-1" />
          </div>

          {/* Navegación */}
          <div className="grid grid-cols-1 gap-8 min-[420px]:grid-cols-2 sm:grid-cols-3">
            {columns.map((column) => (
              <FooterColumn key={column.title} {...column} />
            ))}
          </div>
        </div>

        {/* Pie legal */}
        <div className="mt-10 flex flex-col gap-1 border-t border-white/30 pt-6 text-xs text-white/85 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. Todos los derechos reservados.
          </p>
          {site.taxId || site.publicAddress ? (
            <p>
              {[site.taxId ? `NIT: ${site.taxId}` : null, site.publicAddress]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
