# Oportunidades de mejora (priorizadas)

Prioridades: P0 crítico · P1 importante · P2 diferencial/optimización · P3 opcional. Las estimaciones están en `ESTIMACION_COMPLEJIDAD.md`. Todo lo siguiente es **recomendación**: no se implementó nada.

## P0
| ID | Problema | Evidencia | Mejora | Beneficio | Riesgo | Validación |
|---|---|---|---|---|---|---|
| B-01 | `0029_delivery_fee_a_convenir.sql` usa `true::jsonb`, **no válido en Postgres**; si se ejecutó tal cual, la fila no se creó y el checkout trata "a convenir" como `false` | Falló al aplicar las 33 migraciones en un Postgres de prueba (`cannot cast type boolean to jsonb`) | Cambiar a `'true'::jsonb` (idempotente) y confirmar en Supabase que las migraciones 0030–0033 están aplicadas | Comportamiento correcto del domicilio "a convenir" | Bajo | Consultar `settings` y ejecutar la migración corregida |

## P1
| ID | Problema | Evidencia | Mejora | Beneficio | Dependencias | Riesgo | Validación |
|---|---|---|---|---|---|---|---|
| A-01 | Contraste del botón primario 2,79:1 | axe "serious" en 5/5 páginas; `#fafafa` sobre `#ff6633` | Fondo primario más oscuro para botones con texto blanco, o texto oscuro sobre el naranja; revisar badges y píldoras que usan `primary-foreground` | Cumplir WCAG AA y mejor legibilidad al sol | Aprobación de marca | Cambia la identidad visual | axe sin `color-contrast` |
| A-02 | Objetivos táctiles pequeños | 21 px (nombre), 16 px (reseñas), 32 px (inputs), 18 px (footer) | Mínimo 24 px (2.5.8) y 44 px en controles principales; inputs `h-11` | Menos toques fallidos en móvil | — | Bajo | Script de objetivos < 24 px = 0 |
| P-01 | CLS 0,624 en checkout con carrito guardado | 2/4 corridas; fuentes del desplazamiento: botón y footer | Esperar la hidratación del carrito antes de pintar el formulario o reservar su altura | Estabilidad visual | `store/cart.ts` | Bajo | CLS ≤ 0,1 en 10 corridas |
| U-01 | La primera pantalla no informa domicilio, mínimo, tiempo ni horario de hoy | `page.tsx`; Donde Patty/Luca's lo muestran | Franja con horario de hoy, costo de domicilio, pedido mínimo y tipos de servicio | Menos dudas antes de pedir | Ajustes públicos ya existentes | Bajo | Revisión visual + analítica `begin_checkout` |
| U-02 | Página de producto pobre | `producto/[slug]/page.tsx` | Imagen grande, descripción, adicionales, reseñas, "Combínalo con…", compartir | Mejor SEO de producto y decisión | Datos de relacionados | Medio | Prueba E2E + Lighthouse SEO |
| U-03 | Sin seguimiento del pedido | Domino's "Sigue tu pedido"; confirmación estática | Página `/pedido/estado?t=token` (Pendiente → Entregado) sin cuenta | Menos mensajes de "¿ya viene?" | RPC nueva (como `get_order_confirmation`), sondeo o realtime | Medio (datos personales: mostrar solo estado) | Prueba con token válido/ inválido |
| S-01 | Sin páginas de categoría; sin dirección en datos del negocio | sitemap y `site.ts` | `/menu/[categoria]` con `ItemList`; completar NAP/Google Business cuando el dueño decida | Más búsquedas locales | Datos del negocio | Bajo | Rich Results Test, Search Console |

## P2
| ID | Mejora | Evidencia / razón | Notas |
|---|---|---|---|
| U-04 | Insignias "Más pedido" y "Mejor valorado" en tarjetas | Los datos existen (`sales_report`, reseñas); antes había secciones ocultas | Cachear 1 h; mostrar solo con muestra mínima |
| U-05 | "Pedir de nuevo" | Recompra | Guardar el último pedido en localStorage; para clientes recurrentes |
| U-06 | Promociones (precio anterior, etiqueta) | AUSENTE | Migración + admin; el precio cobrado sigue calculándose en el servidor |
| U-07 | Compartir por WhatsApp/enlace | AUSENTE | `navigator.share` con respaldo |
| T-01 | Pasar la CSP de *report-only* a aplicada | Consola: `upgrade-insecure-requests` ignorado | Revisar `/api/csp-report` antes |
| T-02 | Revisar el chunk `zod` (~108 KB) en `/checkout` | Medición de chunks | **Hipótesis**: se importa en cliente |
| Q-01 | Pruebas E2E del flujo público + axe | Solo hay unitarias | Playwright en CI |

## P3 (opcionales / experimentales)
F-01 filtros y orden (útil solo con > 30 productos) · F-02 favoritos · F-03 cupones de descuento · F-04 landmarks y orden de encabezados · F-05 sugerencia de instalación PWA.

## Ideas de diferenciación evaluadas
| Idea | Problema | Público | Veredicto |
|---|---|---|---|
| Estado del pedido por enlace | Incertidumbre tras pedir | Todos | **Hacer** (U-03) |
| Recompra en un toque | Fricción de repetir | Clientes frecuentes | **Hacer** (U-05) |
| Insignias de prueba social con datos reales | Duda al elegir | Nuevos | **Hacer** (U-04) |
| Información de entrega arriba | Duda de costo/tiempo | Nuevos | **Hacer** (U-01) |
| Combos sugeridos en detalle/resumen | Ticket promedio | Todos | Ya parcial; completar en U-02 |
| Búsqueda con sugerencias, comparación, favoritos | — | — | **No ahora**: ~10 productos |
| IA (asistente, recomendaciones) | — | — | **No**: sin valor demostrable a este tamaño |
| Cupones | Promociones | Marketing | P3: complejidad alta, sin evidencia de necesidad |

Medición de éxito (cuando se implementen): comparar `begin_checkout`→`generate_lead`, tasa `view_item`→`add_to_cart` y CLS/LCP de campo antes y después. **No hay línea base de conversión**, por lo que no se prometen porcentajes.
