# Estimación de complejidad y esfuerzo

Horas de ingeniería incluyendo pruebas y revisión, sobre la arquitectura real (Next 16, Supabase, Tailwind 4). Rangos, no compromisos. Cada tarea cuenta **una sola vez**.

| ID | Tarea | Prio. | Complejidad | Horas | Dependencias / archivos | Riesgo |
|---|---|---|---|---|---|---|
| B-01 | Corregir migración 0029 y confirmar 0030–0033 | P0 | Baja | 0,5–1 | `supabase/migrations/0029…` + SQL Editor (lo ejecuta el dueño) | Bajo |
| A-01 | Contraste del botón primario | P1 | Baja | 3–5 | `globals.css`, `button.tsx`, píldoras | Medio (marca) |
| A-02 | Objetivos táctiles | P1 | Baja | 4–6 | `product-card.tsx`, footer, `input.tsx`, breadcrumbs | Bajo |
| P-01 | CLS del checkout | P1 | Baja | 3–5 | `store/cart.ts`, `checkout-form.tsx` | Bajo |
| U-01 | Franja de información en el hero | P1 | Baja | 3–5 | `page.tsx`, ajustes públicos | Bajo |
| U-02 | Página de producto | P1 | Media | 10–16 | `producto/[slug]/page.tsx`, componentes nuevos | Medio |
| U-03 | Estado del pedido por enlace | P1 | Media-alta | 10–16 | Migración RPC, página nueva, sondeo/realtime | Medio |
| S-01 | Páginas de categoría + datos del negocio | P1 | Media | 8–14 | Rutas nuevas, `structured-data.ts`, sitemap | Bajo |
| U-04 | Insignias "Más pedido / Mejor valorado" | P2 | Baja-media | 4–6 | `sales_report`, `buildProductCards` | Bajo |
| U-05 | Pedir de nuevo | P2 | Media | 6–10 | `store/cart.ts`, confirmación | Bajo |
| U-06 | Promociones | P2 | Media-alta | 10–16 | Migración, admin, tarjetas, checkout | Medio |
| U-07 | Compartir | P2 | Baja | 2–4 | Producto/tarjeta | Bajo |
| T-01 | CSP aplicada | P2 | Media | 3–6 | `next.config.ts`, `/api/csp-report` | Medio (puede bloquear recursos) |
| T-02 | Revisar chunk `zod` | P2 | Baja | 2–4 | Imports del checkout | Bajo |
| Q-01 | E2E + axe en CI | P2 | Media | 12–20 | Playwright (dependencia nueva), datos de prueba | Bajo |
| F-01 | Filtros/orden | P3 | Media | 8–12 | `menu-sections.tsx` | Bajo |
| F-02 | Favoritos | P3 | Media | 6–10 | localStorage + UI | Bajo |
| F-03 | Cupones | P3 | Alta | 20–30 | Migración, admin, validación en servidor | Alto |
| F-04 | Landmarks y encabezados | P3 | Baja | 1–2 | Layouts | Bajo |
| F-05 | Sugerencia de instalar PWA | P3 | Baja | 2–3 | UI | Bajo |

## Totales
| Alcance | Horas |
|---|---|
| P0 | 0,5–1 |
| P1 | 41–67 |
| P2 | 39–66 |
| P3 | 37–57 |
| **P0 + P1** (recomendado como primera fase) | **41,5–68** |
| P0 + P1 + P2 | 80,5–134 |
| **Todo** | **117,5–191** |

Supuestos: un desarrollador que ya conoce el repositorio; sin rediseño de marca; el dueño ejecuta los SQL en Supabase; no incluye gestión de contenido (fotos, textos).

## Qué requiere backend o base de datos
B-01, U-03 (RPC), U-06 (migración), S-01 (datos del negocio, solo configuración), parcialmente U-05.
## Qué se puede sin tocar la arquitectura
A-01, A-02, P-01, U-01, U-04, U-07, T-02, F-04, F-05.
