import type { Metadata } from "next";
import { site, isLegalDraft } from "@/config/site";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Política de cookies",
  description:
    "Qué almacenamiento usa TETSU BURGER, para qué sirve y cómo borrarlo desde tu navegador.",
  alternates: { canonical: "/cookies" },
  ...(isLegalDraft() ? { robots: { index: false, follow: false } } : {}),
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Política de cookies"
      summary="Usamos solo el almacenamiento necesario para que el carrito y el panel funcionen."
    >
      <h2>1. Qué usamos</h2>
      <p>
        Este sitio usa almacenamiento local del navegador para recordar tu
        carrito y una cookie de sesión para el acceso del personal al panel. No
        usamos cookies publicitarias ni de perfilamiento, y los clientes no
        tienen registro ni inicio de sesión.
      </p>

      <h2>2. Almacenamiento necesario</h2>
      <ul>
        <li>
          <strong>Carrito:</strong> guarda los productos y adicionales elegidos
          para que no se pierdan al recargar la página.
        </li>
        <li>
          <strong>Sesión administrativa:</strong> cookie segura para el acceso
          del personal al panel; no aplica a clientes.
        </li>
      </ul>
      <p>Estos elementos no se pueden desactivar porque el sitio no funciona sin ellos.</p>

      <h2>3. Analítica</h2>
      <p>
        Usamos herramientas de medición agregada del sitio (Vercel Analytics y
        Speed Insights). No usan cookies de seguimiento ni identifican personas:
        solo indican qué páginas se visitan y cómo se comporta el rendimiento.
      </p>

      <h2>4. Cómo eliminar el almacenamiento</h2>
      <p>
        Puedes borrar cookies y almacenamiento local desde la configuración de tu
        navegador. Si borras el carrito, perderás los productos seleccionados.
      </p>

      <h2>5. Cambios</h2>
      <p>
        Si cambiamos las categorías o los proveedores, actualizaremos esta
        página.
      </p>

      <p className="text-muted-foreground">
        Para dudas sobre privacidad escribe a{" "}
        <a href={`mailto:${site.privacyEmail}`}>{site.privacyEmail}</a>.
      </p>
    </LegalPage>
  );
}
