# Matriz de funcionalidades

Estados: **CUMPLE** (implementación verificada) · **PARCIAL** · **AUSENTE** · **NO VERIFICABLE**.
"Verificado" = leído en el código **y** probado en un navegador real (build de producción local) salvo que se indique.

## Rúbrica de puntuación 1–5 (solo para el proyecto)
1 = ausente o roto · 2 = parcial con fallos graves · 3 = funciona con fallos notables · 4 = sólido con mejoras menores · 5 = referente del sector. Cada nota cita su evidencia.

## Catálogo público
| Característica | Estado | Evidencia |
|---|---|---|
| Estructura de rutas | CUMPLE | `/`, `/producto/[slug]`, `/resumen`, `/checkout`, `/pedido/confirmado`, `/pqr`, legales; sitemap y robots |
| Categorías | CUMPLE | `menu-sections.tsx` (píldoras + scroll-spy + "Destacados") |
| Páginas de categoría indexables | AUSENTE | solo anclas `/#cat-…` |
| Tarjeta de producto | CUMPLE | `product-card.tsx` (imagen, nombre, descripción, precio, ★, Agregar) |
| Búsqueda | CUMPLE | campo visible, sin tildes, nombre + descripción; sin sugerencias |
| Filtros y ordenamiento | AUSENTE | no necesarios con ~10 productos (9 visibles en la prueba) |
| Detalle de producto | PARCIAL | repite la tarjeta; una imagen; sin relacionados |
| Galería de imágenes | PARCIAL | una imagen ampliable en diálogo |
| Variantes / personalización | CUMPLE | adicionales con cantidad, reglas de combo (a cada producto / hamburguesa / perro), disponibilidad por inventario |
| Disponibilidad | CUMPLE | "Agotado", adicionales "Sin stock", estado Abierto/Cerrado en vivo |
| Promociones / precio anterior | AUSENTE | el esquema solo tiene `price` |
| Productos relacionados | PARCIAL | solo "¿Le sumamos algo?" en `/resumen`; ninguno en detalle |
| Favoritos / vistos recientemente | AUSENTE | — |
| Compartir producto | AUSENTE | sin botón; los metadatos Open Graph sí existen |
| Carrito | CUMPLE | `store/cart.ts` (persistente), panel lateral, píldora fija, `/resumen` editable |
| Checkout | CUMPLE | validación compartida cliente/servidor, errores junto al campo, autocompletado, honeypot + Turnstile + rate limit |
| Pedido por WhatsApp | CUMPLE | botón fijo y mensaje estructurado (`lib/whatsapp.ts`); el pedido se guarda en BD antes |
| Seguimiento del pedido | AUSENTE | confirmación estática; el estado existe solo en el panel |
| Recompra | AUSENTE | — |
| Reseñas | CUMPLE | moderadas, compra verificada por token, JSON-LD `AggregateRating` |
| Información del negocio | PARCIAL | horario, redes, correo, teléfono; **sin dirección ni tiempo estimado** (`site.publicAddress = null`, `estimatedDeliveryTime = null`) |
| Accesibilidad | PARCIAL | contraste del botón primario 2,79:1; objetivos < 24 px; resto sólido (ver UX/UI) |
| SEO técnico | CUMPLE | metadata por página, canonical, sitemap con productos, JSON-LD Restaurant/Menu/Product/Breadcrumb; `noindex` fuera de producción |
| Rendimiento | CUMPLE (local) | LCP ≤ 0,4 s, CLS 0 salvo checkout; sin datos de campo |
| Manejo de errores | CUMPLE | `error.tsx`, `not-found.tsx`, `loading.tsx`, estados vacíos |
| Pruebas | PARCIAL | 50 pruebas unitarias; **sin E2E** |
| Aviso de cookies | N/A | no usa cookies de seguimiento (`/cookies`) |
| Datos de campo (Core Web Vitals reales) | NO VERIFICABLE | requiere Vercel Speed Insights |
| Funcionamiento en producción desplegada | NO VERIFICABLE | no se accedió al dominio ni a las migraciones aplicadas |

## Administración (solo código; sin sesión no se probó en navegador)
Pedidos en vivo con transiciones validadas y "Deshacer", inventario con búsqueda, productos/adicionales/categorías, reseñas, PQR, gastos, caja, cierres, finanzas, reportes con gráficas, rentabilidad, auditoría. Estado general: **CUMPLE en código; NO VERIFICABLE visualmente**.

## Puntuación del proyecto (1–5)
| Criterio | Nota | Fundamento |
|---|---|---|
| Claridad de la primera pantalla | 4 | Estado + titular + CTA + redes; falta info de domicilio |
| Navegación por categorías | 4 | Píldoras con scroll-spy |
| Búsqueda | 4 | Visible, tolerante a tildes; sin sugerencias |
| Tarjeta de producto | 4 | Completa; objetivos táctiles pequeños |
| Detalle de producto | 2 | Repite la tarjeta, sin relacionados |
| Experiencia móvil | 4 | 0 desbordes en 6 anchos; arreglos de esta sesión |
| Flujo de pedido | 4 | Carrito persistente + validación inline; CLS en checkout |
| Accesibilidad | 3 | Contraste 2,79:1 + objetivos táctiles |
| Rendimiento | 4 | LCP local excelente; sin datos reales; CLS 0,62 intermitente |
| SEO | 4 | Muy completo; faltan categorías y dirección |
| Confianza | 3 | Reseñas ✔; sin dirección, tiempo estimado ni seguimiento |
| Diferenciación | 3 | Adicionales/combos y registro propio; sin seguimiento ni recompra |
