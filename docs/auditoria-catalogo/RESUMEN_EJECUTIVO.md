# Resumen ejecutivo — Auditoría del catálogo TETSU BURGER

Fecha de la auditoría: 29/10/2026 · Modo: solo lectura (no se modificó ningún archivo existente ni se instaló nada en el proyecto).

## Qué es el catálogo
Catálogo y pedidos en línea de una hamburguesería de domicilios en Valledupar (Next.js 16 App Router, React 19, Supabase, Tailwind 4). Flujo real: menú → carrito → resumen → checkout (el pedido **queda registrado en base de datos**) → enlace a WhatsApp para confirmar. Tiene panel de administración completo (pedidos en vivo, inventario, finanzas, reportes).

## Veredicto
**Competitivo frente a los catálogos de negocios locales y, en el flujo de pedido, por encima de ellos; todavía por debajo de las cadenas (El Corral, Presto, Domino's) en descubrimiento, página de producto y seguimiento del pedido.** No hace falta rediseñar: basta una intervención selectiva sobre lo que ya funciona.

Respaldado por evidencia: se probó el sitio en un navegador real a 6 anchos (320–1440 px) sin desbordes, LCP local ≤ 0,4 s, 0 errores propios en consola y se observaron 5 catálogos de referencia reales.

## Cinco debilidades principales (con evidencia)
1. **Contraste insuficiente en todos los botones principales**: blanco sobre naranja `#ff6633` = **2,79:1** (mínimo AA: 4,5:1). axe-core lo marca "serious" en 5 de 5 páginas públicas probadas.
2. **Página de producto pobre**: repite la misma tarjeta del menú, una sola imagen, sin productos relacionados, sin compartir (`src/app/producto/[slug]/page.tsx`).
3. **Sin seguimiento del pedido**: tras pedir solo hay un botón de WhatsApp (`src/app/pedido/confirmado/page.tsx`). Domino's ofrece "Sigue tu pedido" en su cabecera.
4. **Objetivos táctiles pequeños**: enlaces de nombre de producto de 21 px de alto, botón "Ver reseñas" de 16 px, campos del checkout de 32 px, enlaces del footer de 18 px.
5. **Salto de diseño (CLS) en el checkout**: 0,624 en 2 de 4 corridas móviles con carrito guardado (umbral "bueno" ≤ 0,1), causado por la hidratación del carrito persistido.

Además, **P0 verificado**: la migración `0029_delivery_fee_a_convenir.sql` falla en Postgres (`true::jsonb` no es válido); se comprobó aplicando las 33 migraciones en un Postgres de prueba.

## Diez mejoras más importantes
Ver `OPORTUNIDADES_DE_MEJORA.md`. En orden: B-01 corregir migración 0029 · A-01 contraste · P-01 CLS del checkout · A-02 objetivos táctiles · U-01 franja de información en el hero · U-02 página de producto · U-03 página de estado del pedido · S-01 SEO (páginas de categoría y datos del negocio) · U-04 insignias "Más pedido / Mejor valorado" · Q-01 pruebas E2E.

## Patrones de la competencia que conviene adaptar (observados)
- **Domino's**: "Sigue tu pedido" visible en la cabecera.
- **El Corral**: elegir "Domicilio / En restaurante" y la ubicación antes de pedir; programa de puntos; WhatsApp como canal alterno.
- **Presto**: categorías como mosaico de fotos grandes de 2 columnas, con CTA "Pide tu domicilio" en la primera pantalla.
- **Donde Patty (OlaClick)**: estado "Cerrado/Abierto" + botón "Pedir" fijos arriba y tipos de servicio con iconos (en el local / para llevar / a domicilio).
- **Luca's Food (VinApp)**: horario y dirección en la primera pantalla; buscador visible.

## Diferenciación más prometedora
Estado del pedido por enlace (sin cuenta), recompra en un toque, insignias de prueba social con datos reales (el sistema ya calcula ventas y reseñas) e información de entrega clara. Lo que **no** conviene: filtros avanzados, favoritos o IA con ~10 productos en el menú (ver matriz).

## ¿Sin cambiar la arquitectura?
Se puede sin tocar arquitectura: A-01, A-02, P-01, U-01, U-04 (parcial), U-07, T-02, F-04. Requieren backend/base de datos: B-01, U-03, U-05 (parcial), U-06, S-01 (datos del negocio).

## Esfuerzo
Total de todas las mejoras: **≈ 118–191 h**. P0 + P1: **≈ 42–68 h**. P0 + P1 + P2: ≈ 80–134 h. Detalle sin duplicidades en `ESTIMACION_COMPLEJIDAD.md`.

## Qué hacer primero
B-01 (corregir 0029) → A-01 y A-02 (accesibilidad, bajo riesgo) → P-01 (CLS) → U-01 (franja de información) → U-03 (estado del pedido).

## Hipótesis que necesitan validación (no son hechos)
- Que mejorar la página de producto o añadir seguimiento aumente la conversión: **sin datos de conversión previos** no se puede estimar un porcentaje. Medir con los eventos de analítica ya existentes (`view_item`, `add_to_cart`, `begin_checkout`, `generate_lead`).
- Que el CLS del checkout afecte usuarios reales: medido solo en local; falta dato de campo (Vercel Speed Insights).

## Limitaciones
- Panel de administración **no auditado visualmente** (no hay credenciales); sí se revisó el código.
- Rappi (redirigió a un buscador), McDonald's (403 "Access Denied") y Burger King Colombia (certificado vencido) no se pudieron observar.
- Mediciones locales en build de producción **sin limitación de red/CPU**: los tiempos son optimistas. No se ejecutó Lighthouse.
- Páginas de producto: solo se midió `/producto/perro-clasic`.
