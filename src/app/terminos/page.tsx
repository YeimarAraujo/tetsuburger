import type { Metadata } from "next";
import { site, isLegalDraft } from "@/config/site";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones de pedido, entrega, pagos, cambios y alérgenos de TETSU BURGER, cocina oculta con domicilios en Valledupar.",
  alternates: { canonical: "/terminos" },
  ...(isLegalDraft() ? { robots: { index: false, follow: false } } : {}),
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      summary="Reglas claras para pedir, recibir y resolver cualquier novedad con tu pedido."
    >
      <h2>1. Identificación del vendedor</h2>
      <p>
        {site.name} es operado por{" "}
        <strong>{site.legalName ?? "el titular del negocio"}</strong>, con
        domicilio en {site.city}, {site.region}, {site.countryName}. Canales de
        contacto: correo{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> y WhatsApp{" "}
        <a href={`https://wa.me/${site.whatsapp}`}>{site.phone}</a>.
      </p>

      <h2>2. Naturaleza del servicio</h2>
      <p>
        {site.name} es una cocina oculta: <strong>solo vendemos para entrega a
        domicilio en {site.city}, {site.region}</strong>. No hay atención al
        público ni recogida en un local. No ofrecemos servicio fuera de la zona
        de cobertura indicada.
      </p>

      <h2>3. Pedidos</h2>
      <ul>
        <li>Los pedidos se registran por el sitio web o por WhatsApp.</li>
        <li>
          Un pedido queda sujeto a disponibilidad de productos, horario de
          atención y confirmación del equipo.
        </li>
        <li>
          Si un producto no está disponible, te lo informamos por WhatsApp para
          reemplazarlo, ajustarlo o cancelarlo.
        </li>
        <li>
          Podemos rechazar pedidos manifiestamente falsos, duplicados o
          realizados fuera de la zona de cobertura.
        </li>
      </ul>

      <h2>4. Precios y medios de pago</h2>
      <ul>
        <li>Los precios se muestran en pesos colombianos (COP).</li>
        <li>
          El valor final incluye el domicilio cuando aplique y se muestra antes
          de confirmar el pedido.
        </li>
        <li>Medios de pago disponibles: efectivo contra entrega y transferencia.</li>
        <li>
          Si el pedido se paga por transferencia, la preparación inicia cuando
          se confirma el pago.
        </li>
      </ul>

      <h2>5. Domicilio y cobertura</h2>
      <p>
        La tarifa de domicilio se informa antes de confirmar. Puede variar según
        la distancia y la hora. La cobertura se limita a {site.city}; si tu
        dirección está fuera del área, te lo informaremos y el pedido no se
        procesará.
      </p>
      {site.estimatedDeliveryTime ? (
        <p>Tiempo estimado de entrega: {site.estimatedDeliveryTime}.</p>
      ) : (
        <p>
          El tiempo estimado de entrega se confirma por WhatsApp al momento de
          aceptar el pedido, según la demanda y la distancia.
        </p>
      )}

      <h2>6. Cancelaciones y cambios</h2>
      <ul>
        <li>
          Puedes cancelar o modificar tu pedido por WhatsApp antes de que
          iniciemos la preparación.
        </li>
        <li>
          Una vez iniciada la preparación o el despacho, no es posible cancelar
          ni modificar el pedido.
        </li>
        <li>
          Si el pedido no puede entregarse por datos incorrectos o por ausencia
          del destinatario, el domicilio no es reembolsable.
        </li>
      </ul>

      <h2>7. Alérgenos y manipulación</h2>
      <p>
        Nuestros productos se preparan en una cocina donde se manipulan
        ingredientes como gluten, lácteos, huevo, soya, frutos secos y
        derivados. No podemos garantizar la ausencia total de trazas. Si tienes
        una alergia o restricción alimentaria, indícalo en las notas del pedido
        o por WhatsApp antes de confirmar.
      </p>

      <h2>8. Reseñas</h2>
      <p>
        Las reseñas se publican después de una revisión y deben ser veraces y
        respetuosas. Podemos rechazar o retirar contenido ofensivo, spam o que
        no corresponda a una experiencia real.
      </p>

      <h2>9. Propiedad intelectual</h2>
      <p>
        El nombre, el logo, las fotografías y los textos de {site.name} son de
        uso exclusivo de su titular. No está permitida su reproducción sin
        autorización.
      </p>

      <h2>10. Responsabilidad</h2>
      <p>
        Respondemos por la preparación y entrega del pedido en las condiciones
        ofrecidas. No somos responsables por retrasos causados por fuerza mayor,
        clima, orden público o información de entrega incorrecta suministrada
        por el cliente.
      </p>

      <h2>11. PQR y ley aplicable</h2>
      <p>
        Cualquier consulta, queja o reclamo puede enviarse a{" "}
        <a href={`mailto:${site.pqrEmail}`}>{site.pqrEmail}</a>, por WhatsApp o
        mediante el <a href="/pqr">formulario de PQR</a>. Estos términos se
        rigen por las leyes de la República de Colombia, en particular el
        Estatuto del Consumidor (Ley 1480 de 2011).
      </p>

      <p className="text-muted-foreground">
        Este documento debe ser revisado por un abogado antes de considerarse
        definitivo.
      </p>
    </LegalPage>
  );
}
