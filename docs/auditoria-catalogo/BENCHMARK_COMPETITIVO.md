# Benchmark competitivo

Consulta: 29/10/2026, navegador real en vista móvil (390 px, iPhone UA) y, cuando aplica, búsqueda web. **Solo lectura**: no se hicieron pedidos ni se enviaron mensajes. Se observó la primera pantalla y lo accesible sin comprar; muchos flujos están tras selección de dirección y JavaScript.

## Referentes observados (5)
| # | Referente | URL | Tipo |
|---|---|---|---|
| 1 | El Corral | https://www.elcorral.com/ | Cadena nacional |
| 2 | Presto | https://www.presto.com.co/ | Cadena nacional |
| 3 | Domino's Colombia | https://www.dominos.com.co/ | Cadena internacional (referente de pedido en línea) |
| 4 | Luca's Food (VinApp) | https://vinapp.co/lucasfood | Competidor directo local, Valledupar |
| 5 | Donde Patty (OlaClick) | https://donde-patty.ola.click/ | Competidor directo local, Valledupar |

**No se pudieron observar**: Rappi (`rappi.com.co/restaurantes/900187347-casa-burger-valledupar` redirigió a `…?restaurantNotFound=true`; búsqueda web confirma que Casa Burger, Rustica, Media Res y Presto operan allí), McDonald's Colombia (HTTP 403 "Access Denied"), Burger King Colombia (certificado vencido). Se registran como NO VERIFICABLES.

## Lo comprobado en cada uno
**El Corral** — Cabecera con menú, búsqueda, programa de lealtad ("Nuevo") y carrito. Selector **Domicilio / En restaurante** y "Ingresa tu ubicación" (al tocarlo: mapa, "Usar mi ubicación actual", dirección manual, iniciar sesión para direcciones guardadas). Carrusel promocional de puntos. "Nuestro menú" con 13 categorías como tarjetas de imagen en 2 columnas. Opción "¡Quiero pedir ya por WhatsApp!". Aviso de cookies que ocupa ~45 % de la pantalla en la primera visita. JSON-LD: solo `LocalBusiness`. 23 imágenes (19 diferidas), todas con `alt`. `h1` visualmente oculto.

**Presto** — Cabecera con menú, dos CTA en la primera pantalla ("Pide tu domicilio", "Ubica nuestras tiendas"), carrusel y categorías como mosaico de 2 columnas con foto grande (Hamburguesas, Smash, Alternativas, Desayunos, Play Box, Helados y postres). JSON-LD con `OfferCatalog`. Sin precios en la portada. 9 imágenes, **9 sin `alt`**. Sin WhatsApp.

**Domino's Colombia** — Navegación: Pide en línea · Menú · Tiendas · **Sigue tu pedido** · Promos · Iniciar sesión · Carrito. Perfil con pedidos favoritos. En móvil la portada muestra textos en inglés ("Welcome to the most advanced ordering platform") en un sitio es-CO. JSON-LD: Organization, WebSite, Restaurant, LocalBusiness. 5 de 8 imágenes sin `alt`.

**Luca's Food** — Portada con foto, dirección y **horario completo** en la primera pantalla; **buscador** visible; 11 categorías en acordeón; ~317 precios y 348 imágenes en el DOM **sin carga diferida** (peso alto); sugerencia de instalar como app (PWA); WhatsApp. Al tocar un producto en mi prueba automatizada no se abrió detalle: **no verificable**.

**Donde Patty** — Insignia **Cerrado/Abierto** y botón "Pedir" fijos arriba; "Menú / Realiza tu pedido" como botón grande; iconos de tipo de servicio (**En el local · Para llevar · A domicilio**), dirección con enlace a mapa, Instagram y "Pedidos por llamadas". JSON-LD Restaurant. Banner publicitario de la plataforma OlaClick sobre la marca del negocio. El menú está tras un botón: **no observado**.

## Qué se compara (y qué no)
No se compara galería, variantes ni comparación de productos porque no se pudieron ver los detalles de producto de los referentes. Las puntuaciones subjetivas se limitan al proyecto (ver rúbrica en `MATRIZ_FUNCIONALIDADES.md`); para los referentes se reportan hechos objetivos o "N/O" (no observado).

## Matriz
Leyenda: ✔ observado · ✘ observado ausente · N/O no observado.

| Característica | TETSU BURGER (medido) | El Corral | Presto | Domino's | Luca's | Donde Patty | Oportunidad |
|---|---|---|---|---|---|---|---|
| Claridad de 1.ª pantalla | Estado, titular, redes, "Ver menú" ✔; sin info de domicilio | Servicio + ubicación + banner ✔ | CTA domicilio/tiendas ✔ | Menú de acciones ✔ | Dirección + horario ✔ | Estado + Pedir ✔ | Franja con horario, domicilio y mínimo (U-01) |
| Navegación por categorías | Píldoras pegadas + scroll-spy ✔ | 13 categorías en tarjetas ✔ | Mosaico 6 categorías ✔ | Menú propio N/O | Acordeón 11 ✔ | N/O | Conservar; considerar mosaico visual solo si crece el menú |
| Búsqueda | ✔ visible (sin tildes) | Icono ✔ (uso N/O) | ✘ en portada | ✘ en portada | ✔ visible | N/O | Sugerencias: P3 |
| Filtros / orden | ✘ | N/O | N/O | N/O | ✘ | N/O | No necesario con ~10 productos |
| Tarjeta de producto | Foto, nombre, descripción, precio, ★, Agregar ✔ | Foto en tarjeta ✔ (precio N/O) | Foto en mosaico ✔ | N/O | Precio ✔ (detalle N/O) | N/O | Insignias "Más pedido" (U-04) |
| Página de detalle | Débil (repite tarjeta) | N/O | N/O | N/O | N/O | N/O | U-02 |
| Variantes/personalización | Adicionales con cantidad y destino en combos ✔ | N/O | N/O | N/O | Categoría "Adiciones" ✔ | N/O | Ya es fortaleza |
| Promociones | ✘ | Carrusel de lealtad ✔ | Carrusel ✔ | "Promos" ✔ | N/O | N/O | U-06 (si el negocio las usa) |
| Seguimiento del pedido | ✘ | N/O | N/O | **"Sigue tu pedido" ✔** | N/O | N/O | U-03 |
| Selector de servicio/ubicación | Tipo de entrega en checkout | **Domicilio/Restaurante + mapa ✔** | Tiendas ✔ | Tiendas ✔ | ✘ | **En el local/Llevar/Domicilio ✔** | Mostrar tipos de servicio arriba (U-01) |
| WhatsApp | Botón fijo + mensaje estructurado ✔ | ✔ alterno | ✘ | ✘ | ✔ | ✔ | Ya es fortaleza |
| Carrito persistente | ✔ (localStorage) | Icono de carrito ✔ (persistencia N/O) | N/O | "Carrito 0" ✔ (persistencia N/O) | N/O | N/O | Ya cumple |
| Cuenta/puntos | ✘ (por diseño) | ✔ | N/O | ✔ | ✘ | ✘ | No necesario |
| Confianza (reseñas) | ✔ reseñas moderadas con compra verificada | N/O | N/O | N/O | N/O | N/O | Mostrar insignias |
| Datos estructurados | Restaurant + Menu + Product + Breadcrumb ✔ | LocalBusiness | OfferCatalog, Organization | Restaurant, LocalBusiness… | ✘ | Restaurant | Ya superior; añadir categorías (S-01) |
| `alt` en imágenes | 0 sin alt ✔ | 0 sin alt ✔ | 9 de 9 sin alt ✘ | 5 de 8 sin alt ✘ | 3 de 348 | 3 de 4 sin alt | Ventaja del proyecto |
| Carga diferida de imágenes | 11 de 14 diferidas ✔ | 19 de 23 ✔ | 0 de 9 | 0 de 8 | **0 de 348 ✘** | 0 de 4 | Ventaja |
| Aviso de cookies | Ninguno (no usa cookies de seguimiento) | Cubre ~45 % de la pantalla | N/O | N/O | N/O | N/O | Ventaja |
| Idioma consistente | ✔ es-CO | ✔ | ✔ | **Textos en inglés en portada ✘** | ✔ | ✔ | — |
| Velocidad | LCP ≤ 0,4 s local (sin red real) | N/O | N/O | N/O | N/O | N/O | Medir con datos de campo |

## Conclusiones respaldadas por evidencia
1. En **datos estructurados, `alt`, carga diferida y ausencia de banners** el proyecto está por encima de los referentes observados.
2. En **estado del pedido, selector de servicio y promociones** las cadenas van por delante.
3. Frente a los competidores locales, el proyecto tiene la ventaja de que **registra el pedido** (los locales dependen de WhatsApp o plataformas) y la desventaja de no mostrar dirección/horario fijo arriba.

## No copiar
No se propone clonar diseños: los patrones se adaptan (franja informativa, estado del pedido, insignias) con la identidad visual propia.
