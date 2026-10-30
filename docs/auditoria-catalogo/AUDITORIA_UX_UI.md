# Auditoría UX/UI

Método: lectura del código + navegador real (Chromium, vista móvil 390 px y escritorio 1440 px, build de producción local) + axe-core 4.10 (WCAG 2.0/2.1/2.2 A y AA + buenas prácticas). Capturas en la carpeta temporal de la sesión (no versionadas).

## A. Primera impresión — CUMPLE
- La primera pantalla móvil muestra: estado Abierto/Cerrado, titular "Sazón sobre la plancha", enlaces a redes y botón "Ver menú" (`src/app/page.tsx`). Con el negocio cerrado aparece una franja bajo el encabezado ("Cerrado ahora · abrimos en…") en lugar de un aviso que bloquea el menú (`store-status.tsx`).
- Falta, en esa primera pantalla: **costo de domicilio, pedido mínimo, tiempo estimado** (`site.estimatedDeliveryTime` es `null`) y **horario de hoy** como dato fijo. Donde Patty y Luca's Food muestran dirección/horario/tipos de servicio arriba.

## B. Navegación y descubrimiento — CUMPLE con matices
- Píldoras de categoría pegadas arriba con scroll-spy, buscador visible (sin tildes, nombre + descripción) y sección "Destacados" (`menu-sections.tsx`). Con ~10 productos es suficiente.
- Sin filtros ni orden: **no es una carencia real a este tamaño** (ver `MATRIZ_FUNCIONALIDADES.md`).
- Sin páginas de categoría indexables (solo anclas `/#cat-…`).

## C. Tarjetas de producto — PARCIAL
- Buenas: imagen cuadrada, nombre enlazado, descripción a 2 líneas, precio, calificación, "Agregar", selector de adicionales con cantidades y reglas de combo.
- Problemas medidos (móvil 390): enlace del nombre **21 px** de alto, botón "Ver reseñas" **16 px** de alto (< 24 px: falla WCAG 2.5.8).
- Correcciones ya hechas en esta sesión: a 320 px la tarjeta se salía de la pantalla (arreglado) y el botón fijo "Ver pedido" se partía en dos líneas (arreglado).

## D. Detalle del producto — PARCIAL (débil)
- `producto/[slug]/page.tsx` renderiza el mismo `ProductCard` que el menú más un párrafo de descripción repetido. Una sola imagen (ampliable), sin productos relacionados, sin compartir, sin información de entrega.
- Bien: migas de pan, metadatos, JSON-LD Product/Breadcrumb, canonical.
- `heading-order` (axe): hay un `h3` directamente bajo el `h1`.

## E. Conversión — PARCIAL
Recorrido: Agregar → (panel/píldora) Ver pedido → `/resumen` (con sugerencias "¿Le sumamos algo?") → `/checkout` → registro + WhatsApp.
- Puntos de posible abandono (hipótesis, sin datos de conversión): checkout con 3 campos obligatorios sin autocompletar hasta esta sesión; falta de información de domicilio/tiempo antes del checkout; no hay seguimiento posterior.
- Fortalezas: carrito persistente, errores de validación junto al campo, resumen con subtotal y domicilio, Turnstile + honeypot discretos.
- **CLS 0,624** en `/checkout` móvil (2 de 4 corridas, con carrito guardado): el desplazamiento mueve el botón de enviar y el footer. Sin carrito guardado: 0.

## F. Diseño adaptable — CUMPLE (público)
Revisión automática de 10 rutas × 6 anchos (320, 360, 390, 768, 1024, 1440): **0 desbordes** (único marcado: `/no-existe`, título `sr-only`, falso positivo). El panel de administración **no se pudo verificar** (requiere sesión); hay un script listo para ejecutarlo con credenciales propias.

## Accesibilidad (axe, móvil y escritorio)
| Regla | Impacto | Dónde | Causa |
|---|---|---|---|
| color-contrast | serious | `/`, `/resumen`, `/producto/*`, `/checkout` | Botón primario: `#fafafa` sobre `#ff6633` = **2,79:1** (se exige 4,5:1 para texto de 14 px) |
| region | moderate | todas | Contenido flotante/anuncios fuera de landmarks |
| heading-order | moderate | `/producto/*` | `h3` bajo `h1` |

Objetivos táctiles < 40 px (móvil): `/` 31, `/producto` 14, `/resumen` 20, `/checkout` 13, `/pqr` 16 (campos de 32 px de alto, "Volver" de 34 px, botones +/− de 36 px).
Bien: 0 imágenes sin `alt` en las páginas públicas probadas; grupos de radio con teclado en el checkout; `lang="es-CO"`.

## Rendimiento y consola (local, producción, sin limitación)
- LCP 71–192 ms, CLS 0 en inicio/producto/resumen. TTFB < 25 ms. (Optimistas por no haber red real.)
- JS de la portada: **~794 KB descomprimidos en 19 archivos** (se sirven con gzip). `html5-qrcode` (364 KB, lector de códigos del admin) y `supabase-js` **no** se cargan en las páginas públicas.
- El chunk `zod` (~108 KB) sí se carga en `/checkout`: **hipótesis** a verificar (T-02).
- Consola: 5 mensajes, todos ajenos al código de negocio: 2× script de Vercel Insights 404 (solo ocurre fuera de Vercel), 1× aviso `upgrade-insecure-requests` ignorado por CSP en modo *report-only*.
