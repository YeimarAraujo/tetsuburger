# Plan de implementación (propuesto, no iniciado)

No se implementará nada hasta recibir autorización explícita. No se propone un rediseño completo: se reaprovechan los componentes que ya funcionan.

## Etapa 1 — Correcciones esenciales (≈ 10–17 h)
**Tareas**: B-01, A-01, A-02, P-01.
**Archivos**: `supabase/migrations/0029…`, `src/app/globals.css`, `src/components/ui/button.tsx`, `product-card.tsx`, `site-footer.tsx`, `input.tsx`, `store/cart.ts`, `checkout-form.tsx`.
**Dependencias**: aprobación del color de marca (A-01); el dueño aplica el SQL (B-01).
**Aceptación**: axe sin `color-contrast`; 0 objetivos táctiles < 24 px en las páginas públicas; CLS ≤ 0,1 en 10 corridas del checkout móvil; fila `delivery_fee_a_convenir` presente en `settings`.
**Regresión**: auditoría responsive a 6 anchos, flujo agregar→checkout→confirmación.
**Riesgos**: cambio de marca visible; validar en teléfono real.

## Etapa 2 — Optimización UX/UI (≈ 14–23 h)
**Tareas**: U-01, U-02, F-04 (landmarks y orden de encabezados).
**Aceptación**: la primera pantalla muestra horario de hoy, domicilio y mínimo; la página de producto tiene imagen grande, relacionados y compartir; `heading-order` sin fallos.
**Pruebas**: revisión visual móvil/escritorio, pruebas E2E del detalle.

## Etapa 3 — Conversión (≈ 18–30 h)
**Tareas**: U-03 (estado del pedido), U-05 (recompra), U-07 (compartir).
**Backend**: RPC nueva que devuelva solo estado y número de pedido por token.
**Aceptación**: token válido muestra el estado actual; token inválido, mensaje neutro; sin datos personales en la respuesta.
**Medición**: comparar mensajes de "¿cómo va mi pedido?" y la tasa de recompra durante 4 semanas.

## Etapa 4 — Diferenciación (≈ 14–22 h)
**Tareas**: U-04 (insignias), U-06 (promociones, solo si el negocio las usa).
**Aceptación**: insignias solo con muestra mínima; el precio cobrado se calcula siempre en el servidor.

## Etapa 5 — Rendimiento, SEO y calidad (≈ 25–44 h)
**Tareas**: S-01 (categorías + datos del negocio), T-01 (CSP), T-02 (chunk `zod`), Q-01 (E2E + axe).
**Aceptación**: páginas de categoría en el sitemap con JSON-LD `ItemList`; E2E del flujo público en CI; CSP sin violaciones durante 2 semanas antes de aplicarla.
**Prerrequisito**: medir Core Web Vitals de campo (Speed Insights) antes y después.

Las etapas suman ≈ 82–136 h. Quedan fuera las tareas P3 F-01, F-02, F-03 y F-05 (≈ 36–55 h), que se decidirán según los datos.

## Pruebas de regresión transversales
`npx tsc --noEmit`, `npx eslint`, `npx vitest run`, `npx next build`, auditoría responsive a 320/360/390/768/1024/1440, axe, objetivos táctiles, CLS del checkout.

## Orden recomendado
B-01 → A-01 → A-02 → P-01 → U-01 → U-03 → U-02 → S-01 → U-04 → resto.
