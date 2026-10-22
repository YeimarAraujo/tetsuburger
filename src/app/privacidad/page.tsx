import type { Metadata } from "next";
import { site, isLegalDraft } from "@/config/site";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos personales",
  description:
    "Cómo TETSUBURGER trata los datos personales de sus clientes en Valledupar: finalidades, derechos, canales y plazos.",
  alternates: { canonical: "/privacidad" },
  ...(isLegalDraft() ? { robots: { index: false, follow: false } } : {}),
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de tratamiento de datos personales"
      summary="Información sobre los datos que tratamos al hacer un pedido, tus derechos y cómo ejercerlos."
    >
      <h2>1. Quién trata tus datos</h2>
      <p>
        {site.name} es un servicio de comida a domicilio con domicilio en{" "}
        {site.city}, {site.region}, {site.countryName}. Para cualquier asunto
        relacionado con datos personales puedes escribir a{" "}
        <a href={`mailto:${site.privacyEmail}`}>{site.privacyEmail}</a> o al
        WhatsApp <a href={`https://wa.me/${site.whatsapp}`}>{site.phone}</a>.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>Datos de identificación y contacto: nombre y teléfono.</li>
        <li>Dirección de entrega y referencias del domicilio.</li>
        <li>Detalle del pedido, notas, medio de pago y valor.</li>
        <li>Reseñas que decidas publicar, junto con el nombre que indiques.</li>
        <li>
          Datos técnicos necesarios para la seguridad del servicio, como
          registros de acceso (por ejemplo, dirección IP) y eventos de error.
        </li>
      </ul>
      <p>
        No solicitamos datos sensibles ni datos de menores de edad. Si un
        menor realiza un pedido, debe hacerlo con la autorización de su
        representante legal.
      </p>

      <h2>3. Para qué usamos los datos</h2>
      <ul>
        <li>Registrar, preparar y entregar tu pedido.</li>
        <li>Contactarte por WhatsApp para confirmar pago, dirección o novedades.</li>
        <li>Atender consultas, quejas y reclamos (PQR).</li>
        <li>Prevenir fraude, abuso y pedidos falsos.</li>
        <li>Mejorar el menú, la atención y el rendimiento del sitio.</li>
        <li>Cumplir obligaciones legales, contables y fiscales aplicables.</li>
      </ul>
      <p>
        La analítica es agregada y no usa cookies ni identificadores
        personales, por lo que no requiere consentimiento.
      </p>

      <h2>4. Autorización y base del tratamiento</h2>
      <p>
        Al confirmar un pedido autorizas el tratamiento de tus datos para las
        finalidades descritas. Puedes revocar esta autorización en cualquier
        momento; la revocatoria no afecta los tratamientos realizados antes ni
        los que sean necesarios para cumplir obligaciones legales.
      </p>

      <h2>5. Tus derechos</h2>
      <p>
        De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013, puedes:
      </p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Solicitar prueba de la autorización otorgada.</li>
        <li>Ser informado sobre el uso de tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
        <li>Revocar la autorización y solicitar la supresión cuando sea procedente.</li>
        <li>Acceder gratuitamente a tus datos.</li>
      </ul>

      <h2>6. Consultas, reclamos y PQR</h2>
      <p>
        Puedes ejercer tus derechos por correo a{" "}
        <a href={`mailto:${site.privacyEmail}`}>{site.privacyEmail}</a>, por
        WhatsApp al <a href={`https://wa.me/${site.whatsapp}`}>{site.phone}</a>{" "}
        o mediante el <a href="/pqr">formulario de PQR</a>. Para proteger tus
        datos podemos pedirte que acredites tu identidad.
      </p>
      <ul>
        <li>
          <strong>Consultas:</strong> se responden en un máximo de 10 días
          hábiles, prorrogables por 5 días hábiles.
        </li>
        <li>
          <strong>Reclamos:</strong> se atienden en un máximo de 15 días
          hábiles, prorrogables por 8 días hábiles.
        </li>
      </ul>

      <h2>7. Encargados y transferencias</h2>
      <p>
        Usamos proveedores de infraestructura y base de datos (Supabase) y de
        alojamiento del sitio (Vercel). Estos proveedores pueden almacenar
        información fuera de Colombia; en ese caso la transferencia se realiza
        con las garantías y controles previstos por la normativa aplicable.
        No vendemos ni alquilamos datos personales.
      </p>

      <h2>8. Retención</h2>
      <p>
        Conservamos los datos del pedido mientras exista la relación comercial
        y durante el tiempo necesario para atender obligaciones legales,
        contables y fiscales. Cuando dejan de ser necesarios se suprimen o se
        anonimizan.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables: acceso
        restringido al panel administrativo, autenticación, control de acceso a
        la base de datos y registro de operaciones. Ningún sistema es
        absolutamente infalible, pero revisamos y actualizamos estas medidas.
      </p>

      <h2>10. Cambios a esta política</h2>
      <p>
        Podemos actualizar este documento. La versión vigente y la fecha de
        actualización aparecen al inicio de la página. Si el cambio es
        sustancial, lo informaremos en el sitio o por los canales de contacto.
      </p>

      <p className="text-muted-foreground">
        Este documento debe ser revisado por un abogado antes de considerarse
        definitivo.
      </p>
    </LegalPage>
  );
}
