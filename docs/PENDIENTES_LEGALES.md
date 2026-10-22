# Pendientes legales y administrativos

> Documento **informativo**. No afirma que estos trámites sean obligatorios en
> tu caso ni reemplaza la asesoría de un contador o abogado. Verifica cada
> punto con un profesional antes de invertir tiempo o dinero.

## Trámites a verificar

1. **RUT / NIT ante la DIAN** — registro como persona natural o jurídica y
   régimen tributario aplicable. Hoy `site.taxId` es `null`: cuando tengas el
   NIT, agrégalo en `src/config/site.ts` y aparecerá automáticamente en el
   footer, las políticas y el JSON-LD.
2. **Matrícula mercantil** en la Cámara de Comercio de Valledupar, si la
   actividad lo requiere.
3. **Concepto sanitario y permisos de la secretaría de salud** para elaborar y
   comercializar alimentos.
4. **Curso de manipulación de alimentos** para quien prepara los pedidos.
5. **Facturación** — revisa con tu contador si debes emitir factura electrónica
   y desde cuándo.
6. **Registro Nacional de Bases de Datos (RNBD)** ante la SIC, si aplica a tu
   operación. La política de privacidad ya describe el tratamiento, pero el
   registro es un trámite aparte.
7. **Identificación del vendedor en comercio electrónico** — la Ley 1480 de
   2011 puede exigir datos de identificación y contacto del vendedor. Hoy la
   web muestra nombre comercial, nombre del responsable, ciudad, correo y
   WhatsApp. **Confirma con un abogado** si falta algún dato (NIT, dirección,
   etc.) y agrégalo en `site.ts`.

## Cuando tengas cada dato

| Dato | Dónde va | Qué se actualiza solo |
|---|---|---|
| NIT | `site.taxId` | Footer, políticas legales, JSON-LD |
| Dirección pública | `site.publicAddress` | Footer, políticas legales, JSON-LD |
| Ficha de Google | `site.social.googleBusiness` | Footer (`sameAs`) y JSON-LD |
| Dominio | `NEXT_PUBLIC_SITE_URL` | `metadataBase`, canonical, sitemap, OG |
| Tiempo de entrega | `site.estimatedDeliveryTime` | Checkout y términos |
| Correo de privacidad | `site.privacyEmail` | Políticas y PQR |
| Correo PQR | `site.pqrEmail` | Términos, PQR y footer |

## Revisión legal

Los textos de `/privacidad`, `/terminos` y `/cookies` son una base redactada
con los datos confirmados. **Deben ser revisados por un abogado antes de
considerarse definitivos.** Mientras `site.legalName` esté vacío o empiece por
`TODO_`, las páginas se publican con banda de borrador y `noindex`.
