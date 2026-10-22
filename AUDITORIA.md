# Auditoría técnica, SEO y cumplimiento web — TETSUBURGER

**Fecha:** 22 de octubre de 2026 · **Alcance:** repositorio completo (`C:\Programacion\tetsuburger`) · **Auditor:** revisión estática + ejecución real de build/lint/tsc/audit + servidor de producción local + Lighthouse (Chrome headless)
**Alcance de cambios:** no se modificó ningún archivo del proyecto. Este documento es el único archivo creado.

---

## 0. Resumen ejecutivo

1. **El sitio es técnicamente sólido en su núcleo**: App Router + server actions con validación zod, honeypot, RBAC real en `/admin` (proxy + layout + `checkStaff`), RLS verificada empíricamente en Supabase, `lint` y `tsc` limpios, y Lighthouse 99/96/100/100 en escritorio.
2. **El mayor riesgo es de cumplimiento, no de código**: no existe aviso de privacidad, política de tratamiento de datos, términos, aviso de cookies ni datos del titular (razón social, NIT, dirección) — y el sitio ya recolecta nombre, teléfono y dirección de clientes en cada pedido, lo que activa la Ley 1581 de 2012 y las directrices de la SIC.
3. **Hay dos vulnerabilidades críticas de Next.js sin parchear**: `next@16.3.2` está dentro del rango de dos RCE sin autenticación (`GHSA-p293-qw3h-jr36` CVSS 9.0 en hosting Windows y `GHSA-2xp9-vwfh-vxw4` en la API de optimización de imágenes con AVIF); el fix es `next@16.4.2` y no es un salto de major.
4. **El SEO está por construir**: 0 JSON-LD, 0 Open Graph, 0 canonical, sin `sitemap.xml` (404), sin `robots.txt` (404), sin manifest, `lang="es"` en vez de `es-CO`, title/description duplicados en 4 de 5 rutas y **ninguna página de producto indexable** (todo el catálogo vive en modales dentro del home).
5. **La conversión no está instrumentada ni guided**: no hay botón de WhatsApp en ninguna pantalla pública (solo se genera el enlace `wa.me` después del pedido), no hay analítica, no hay banner de consentimiento, el home compite con 4 CTAs simultáneos y no tiene CTA principal, y el contraste de la marca falla WCAG AA en 32 elementos (naranja `#ff6633` con texto blanco = 2,79:1).

**Puntaje global estimado: 41 / 100**

> **Estado de ejecución (22 de octubre de 2026).** Los lotes 0 a 8 se aplicaron
> sobre ramas separadas y verificaron con `lint`, `tsc`, `build`, pruebas HTTP y
> smoke tests locales. Ver el detalle al final de este documento
> (`## 9. Estado de ejecución`). Este informe describe el estado **inicial**
> auditado; las correcciones indicadas allí ya están implementadas en el código.

---

## 1. Metodología y entorno verificado

| Paso | Resultado |
|---|---|
| Lectura de stack | `package.json`, `next.config.ts`, `src/proxy.ts`, `src/lib/supabase/middleware.ts`, `src/app/**`, `src/components/**`, `src/features/**`, `supabase/migrations/**`, `public/**` |
| `npm run lint` | **0 errores** (eslint-config-next/core-web-vitals + typescript) |
| `npx tsc --noEmit` | **exit 0**, sin errores |
| `npm run build` | **OK** — Next 16.3.2 (Turbopack), 17 rutas, "Compiled successfully in 1448 ms", sin avisos de bundle |
| `npm audit` | Falla sobre `node_modules`: `400 Bad Request … Invalid package tree`. Ejecutado con `npm audit --package-lock-only` → **21 vulnerabilidades (2 críticas, 15 altas, 4 moderadas)** |
| Servidor de producción | `npm run start -p 3111` → responde 200 en `/` (114 301 bytes) |
| Lighthouse 12 + Chrome headless | Home escritorio, home móvil, `/checkout` escritorio, 404 por HTTP |
| Pruebas HTTP | HEAD/GET de 9 rutas públicas y de admin; verificación de cabeceras, cookies y metadatos del HTML servido |
| Pruebas Supabase | Consultas REST con clave **anon** (pública) frente a **service_role**, para medir el aislamiento real de RLS |

**Limitaciones declaradas:** el dominio de producción no está en el repositorio (`GUIA_DE_USO.md:21` usa el placeholder `tudominio.com`) y no existe carpeta `.vercel`, por lo que HTTPS forzado, redirección www/no-www, ficha de Google Business Profile y comportamiento en CDN **no son verificables** desde el código. Lighthouse se ejecutó en local (Windows, sin CDN): el TTFB y el LCP reales en producción pueden diferir.

---

## 2. Stack detectado (real, no supuesto)

| Capa | Tecnología | Evidencia |
|---|---|---|
| Framework | **Next.js 16.3.2** (App Router, Turbopack) | `package.json:26`; `next.config.ts` sin `pages/`, solo `src/app/` |
| UI runtime | React 19.2.8 + TypeScript 5.9.3 | `package.json:22-23` |
| Estilos | **Tailwind CSS v4** (`@theme inline`, tokens OKLCH) + `tailwind-merge` 3.6 | `src/app/globals.css:7-86` |
| Componentes | shadcn/Radix (`radix-ui` 1.6.7) + CVA + lucide-react + sonner | `src/components/ui/*` (24 componentes) |
| Datos | **Supabase** (Postgres + Auth + Storage) vía `@supabase/ssr` + `@supabase/supabase-js` | `src/lib/supabase/{client,server,admin,middleware}.ts` |
| Validación | zod 4.4.3 (esquemas en `src/features/*/schema.ts` y dentro de las actions) | `src/features/orders/actions.ts:24` |
| Estado cliente | zustand 5 (carrito en `src/store/cart.ts`) | — |
| Fuentes | `next/font/google`: Plus Jakarta Sans, Anton, Geist Mono | `src/app/layout.tsx:8-24` |
| Control de acceso | `src/proxy.ts` (renombrado de middleware en Next 16) con matcher `/admin/:path*` | `src/proxy.ts:28-30` |
| **Ausentes** | sin framework de tests, sin analítica, sin CMS, sin i18n, sin PWA/manifest, sin CSP | `package.json:5-10` |

---

## 3. Puntaje estimado por área

| Área | Puntaje | Comentario |
|---|---:|---|
| Legal / Cumplimiento (Colombia) | **12 / 100** | 0 documentos legales, 0 banner, 0 datos del titular, 0 consentimiento; la recolección de datos ya está operativa |
| Técnico / cabeceras de seguridad | **55 / 100** | HSTS + 4 cabeceras presentes, pero **sin CSP**, `X-Powered-By` visible, 2 RCE críticas sin parchear, rate limit en memoria |
| SEO | **25 / 100** | Lighthouse da 100/100 en SEO pero solo audita metadatos básicos: no hay canonical, OG, JSON-LD, sitemap, robots ni páginas de producto |
| Imágenes y rendimiento | **58 / 100** | 0 etiquetas `<img>`, next/image bien usado; LCP móvil 3,5 s, TTFB 820 ms, 3 imágenes de 1,5 MB, sin AVIF |
| UX / Accesibilidad | **52 / 100** | Lighthouse a11y 0,90: 32 fallos de contraste, botón sin nombre en móvil, `label-content-name-mismatch`, 404 en inglés, áreas táctiles de 28–36 px |
| Formularios | **62 / 100** | zod + honeypot + botón deshabilitado + anti-doble-envío correctos; **sin CAPTCHA** y rate limit no persistente |
| Conversión | **20 / 100** | Sin WhatsApp en pantallas públicas, sin CTA única, sin analítica ni consentimiento, sin eventos |
| Seguridad y calidad | **48 / 100** | Auth/RLS/RBAC sólidos, `lint`/`tsc` limpios; repo **público** en GitHub, sin tests, RLS no replicado en migraciones |
| **GLOBAL** | **41 / 100** | |

---

## 4. Tabla de hallazgos

**Leyenda de estado:** `CUMPLE` · `PARCIAL` · `NO CUMPLE` · `NO VERIFICABLE`

### 4.1 Legal y cumplimiento (Colombia — Ley 1581 de 2012, Decreto 1377 de 2013, SIC)

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| L1 | Aviso de privacidad / política de tratamiento de datos | **NO CUMPLE** | No existe ninguna ruta legal: `Get-ChildItem -Recurse src/app -Include "privacidad*","legal*","terminos*","cookies*"` → 0 resultados. El pie de `src/app/page.tsx:269-276` solo renderiza `settings.address` (vacío en BD) + copyright. Los `href` reales del home son únicamente assets (`/`, `/favicon.ico`, `/images/logo.webp`, `/_next/...`) | Alto | M |
| L2 | Datos del titular (razón social, NIT, dirección, correo, teléfono) | **NO CUMPLE** | Consulta a `settings` con service_role (15 filas): existen `currency, timezone, whatsapp_number, banner_text, hero_image, closed_message, address, instagram_url, facebook_url, delivery_fee, min_order_total, store_temporarily_closed, allow_orders_outside_hours, rentabilidad_business_costs, caja_base`. **`address=''`, `facebook_url=''`, y no hay NIT, razón social, correo ni horario**. El footer muestra la dirección solo si no está vacía (`page.tsx:271-273`) → hoy no muestra nada | Alto | S (datos) + M (UI) |
| L3 | Aviso y banner de cookies con "rechazar" y "configurar" | **NO CUMPLE** | No existe componente de consentimiento (grep de `cookie`/`consent` en `src/` → 0 coincidencias de UI). Estado actual verificado: `GET /`, `/checkout` y `/admin/login` **no devuelven `Set-Cookie`** → hoy no hay cookies de terceros; el banner se vuelve obligatorio en cuanto se añada analítica | Medio | M |
| L4 | Términos y condiciones | **NO CUMPLE** | No existe ruta ni texto de términos. El pedido online solo se describe en `src/components/public/checkout-form.tsx:220-227` (tarifa de domicilio variable) y `src/lib/whatsapp.ts:31` | Medio | M |
| L5 | Canal PQR | **NO CUMPLE** | No hay sección, enlace, correo PQR ni formulario de quejas en todo el `src/` (grep `PQR\|queja\|reclamo` → 0). El correo de contacto solo existe en la guía interna: `GUIA_DE_USO.md:281` (`tetsuburger@gmail.com`), no en el sitio | Medio | S |
| L6 | Consentimiento explícito y aviso al recolectar datos del pedido | **NO CUMPLE** | `src/components/public/checkout-form.tsx:123-149` solicita nombre, teléfono y dirección **sin casilla de consentimiento, sin enlace a la política y sin aviso de tratamiento**. El servidor valida formato (`src/features/orders/actions.ts:24-40`) pero no hay fundamento de tratamiento ni registro de consentimiento | Alto | S |
| L7 | Permisos/RLS de la base de datos | **PARCIAL** | **Producción: correcto (verificado empíricamente).** Con clave anon: `orders` 0 filas (service_role ve 236), `expenses` 0 (31), `inventory_items` 0 (29), `audit_logs` 0 (3671), `daily_closings` 0 (18), `product_reviews` 3 de 4 (solo las `APROBADO`), `settings` 12 de 15 (solo `is_public=true`). **Pero las migraciones no contienen el RLS**: 26 archivos en `supabase/migrations/` con **0 coincidencias** de `ENABLE ROW LEVEL SECURITY` y **0** de `CREATE POLICY` → un `supabase db reset` dejaría la base pública | Alto | M |
| L8 | Derechos del titular (acceso, rectificación, supresión, portabilidad) y retención | **NO CUMPLE** | No hay política, no hay procedimiento de supresión de `orders`/`product_reviews` y no hay política de retención. `orders` retiene nombre, teléfono y dirección de forma indefinida (236 filas) | Medio | M |
| L9 | Tratamiento de cookies de sesión del panel (Supabase Auth) | **PARCIAL** | Las cookies de sesión se emiten en el área protegida (`src/lib/supabase/middleware.ts:16-30`) pero ninguna política las menciona | Bajo | S |
| L10 | Prueba de las condiciones comerciales de venta | **PARCIAL** | `checkout-form.tsx:220-227` y `whatsapp.ts:31` aclaran que el domicilio es variable, pero no hay contrato escrito ni política de pagos/reembolsos | Bajo | S |

### 4.2 Técnico y cabeceras de seguridad

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| T1 | **Content-Security-Policy** | **NO CUMPLE** | `next.config.ts:3-13` define 6 cabeceras y CSP no está entre ellas. Cabeceras observadas en la respuesta real: `Permissions-Policy`, `Referrer-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `X-Powered-By` — **sin CSP** | Alto | M |
| T2 | HTTPS forzado | **NO VERIFICABLE** | HSTS sí está: `next.config.ts:10-12` → `max-age=63072000; includeSubDomains; preload`, confirmado en la respuesta real. El salto `http→https` depende del hosting (no hay `.vercel` ni dominio en el repo) | Medio | S |
| T3 | Redirección www / no-www | **NO CUMPLE** (en repo) | No hay `redirects()` en `next.config.ts` ni host canónico declarado. `GUIA_DE_USO.md:21` documenta `tudominio.com` como placeholder | Medio | S |
| T4 | URL canónica (`rel=canonical`) | **NO CUMPLE** | `src/app/layout.tsx:26-33` no define `metadataBase` ni `alternates.canonical`; verificado en HTML servido: **0** `rel="canonical"` en `/`, `/checkout`, `/resumen`, `/pedido/confirmado` y `/admin/login` | Alto | S |
| T5 | Versión de Next.js con CVEs críticos | **NO CUMPLE** | `package.json:26` → `next@16.3.2`. `npm audit --package-lock-only` reporta en `next` (directa, **crítica**, rango `16.0.0 - 16.3.7`): `GHSA-p293-qw3h-jr36` *"Unauthenticated Remote Code Execution on windows-hosted servers"* (CVSS 9.0, rango `>=16.0.0 <16.3.3`), `GHSA-2xp9-vwfh-vxw4` *"RCE in Image Optimization API when AVIF files are used"* (rango `>=16.0.0 <16.3.3`), `GHSA-vcvr-r3jv-pc5j` (RCE en `next/og`, rango `>=16.2.0 <16.3.6`), `GHSA-cjq9-62q9-8jv4` (SSRF, alta). Fix disponible: `next@16.4.2` (**no es major**) | **Crítico** | S |
| T6 | `npm audit` ejecutable / árbol de dependencias reproducible | **PARCIAL** | `npm audit` → `Invalid package tree, run npm install to rebuild your package-lock.json`. `npm ls --depth=0` muestra 6 paquetes **extraneous** no presentes en el lock: `@emnapi/core@1.10.0`, `@emnapi/runtime@1.11.3`, `@emnapi/wasi-threads@1.2.1`, `@img/sharp-wasm32@0.35.3`, `@napi-rs/wasm-runtime@1.2.3`, `@tybys/wasm-util@0.10.3` → `npm ci` en CI puede fallar | Medio | S |
| T7 | `X-Powered-By` expuesto | **PARCIAL** | Respuesta real: `X-Powered-By: Next.js`. `next.config.ts` no define `poweredByHeader: false` | Bajo | S |
| T8 | `X-XSS-Protection` obsoleto | **PARCIAL** | `next.config.ts:8` → `1; mode=block`. Está obsoleto y es ignorado por todos los navegadores modernos (se recomienda retirarlo) | Bajo | S |
| T9 | Límite de tamaño del cuerpo de Server Actions | **PARCIAL** | `next.config.ts:16-19` → `bodySizeLimit: "10mb"` (default de Next: 1 MB) → superficie ampliada para DoS por cuerpos enormes | Bajo | S |
| T10 | Caché del home desactivada | **NO CUMPLE** | `src/app/page.tsx:16` → `export const dynamic = "force-dynamic"`. Respuesta real: `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Lighthouse: `server-response-time` = **820 ms (score 0)** y el LCP de escritorio tiene **98 % en TTFB** | Alto | M |
| T11 | Repositorio GitHub **público** | **PARCIAL** | `api.github.com/repos/YeimarAraujo/tetsuburger` → `private=false, visibility=public`, `default_branch=main`. Sin secretos en el código (166 archivos trackeados, 0 coincidencias de `eyJ…|sk-|sb_secret_|AIza…|BEGIN PRIVATE`) y `.env.local` **no** está trackeado (`git ls-files --error-unmatch .env.local` → error; `.gitignore:34` cubre `.env*`) ✓, pero todo el código del panel y la lógica de las Server Actions es legible públicamente | Medio | S |
| T12 | Secretos fuera del bundle de cliente | **CUMPLE** | `src/lib/supabase/admin.ts:1` → `import "server-only"`. Verificado: 0 coincidencias de un JWT de ≥200 chars en `.next/static/**/*.js` | Bajo | S |
| T13 | Ejecución limpia de lint / TypeScript / build | **CUMPLE** | `npm run lint` → 0 errores; `npx tsc --noEmit` → exit 0; `npm run build` → OK, 17 rutas generadas, sin warnings | Bajo | S |

### 4.3 SEO

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| S1 | `title` único y descriptivo por página | **PARCIAL** | Solo 2 de 5 rutas públicas lo declaran: `src/app/checkout/page.tsx:6-7` y `src/app/resumen/page.tsx:6-7`. `/`, `/pedido/confirmado` y `/admin/login` heredan `"TETSUBURGER"` (`src/app/layout.tsx:27`). Verificado en el HTML servido | Alto | S |
| S2 | `meta description` única por página | **NO CUMPLE** | Las 5 rutas probadas devuelven **la misma**: `content="Sazón sobre la plancha"` (26 caracteres, sin ubicación, categoría ni llamada a la acción) — `src/app/layout.tsx:28-29` | Alto | S |
| S3 | Open Graph / Twitter Cards | **NO CUMPLE** | **0** etiquetas `og:` y **0** `twitter:` en el HTML de las 5 rutas. Sin `metadataBase` tampoco habría URL absoluta de imagen → al compartir en WhatsApp/Instagram (canal principal de un restaurante) no hay tarjeta enriquecida | Alto | M |
| S4 | `lang="es-CO"` | **PARCIAL** | `src/app/layout.tsx:42` → `<html lang="es">`; verificado en el HTML servido. Sin variante regional es-CO | Medio | S |
| S5 | Un único `<h1>` por página | **PARCIAL** | `/` → 1 h1 (`page.tsx:255`), `/checkout` → 1, `/admin/login` → 1. **`/resumen` → 0 h1** cuando el carrito está vacío: el h1 solo existe en `src/components/public/resumen-content.tsx:43` (rama con items) | Medio | S |
| S6 | JSON-LD (Restaurant/LocalBusiness, Menu, Product/Offer, Breadcrumb) | **NO CUMPLE** | Grep de `ld+json\|application/ld` en todo `src/` → **0 coincidencias**; **0** en el HTML servido. No hay datos estructurados de ningún tipo | Alto | M |
| S7 | `sitemap.xml` | **NO CUMPLE** | `GET /sitemap.xml` → **404**; no existe `src/app/sitemap.ts` | Alto | S |
| S8 | `robots.txt` | **NO CUMPLE** | `GET /robots.txt` → **404**; no existe `src/app/robots.ts` | Medio | S |
| S9 | Manifest / instalable como app | **NO CUMPLE** | `GET /manifest.webmanifest` → **404**; no existe `src/app/manifest.ts` ni `metadata.manifest` | Medio | S |
| S10 | Favicon, apple-touch-icon, iconos | **PARCIAL** | `src/app/favicon.ico` ✓ (servido con `rel="icon"`) y `src/app/layout.tsx:30-32` declara `icons.icon: "/images/logo.webp"` ✓. **`GET /apple-touch-icon.png` → 404** y no hay `appleWebApp` → al "añadir a pantalla de inicio" en iOS no hay icono propio | Medio | S |
| S11 | Páginas de producto indexables | **NO CUMPLE** | Todo el catálogo se renderiza en el home (`src/app/page.tsx:266` → `<MenuSections>`) y se abre en **modales** (`src/components/public/product-card.tsx`). No existen rutas `/producto/[slug]`, aunque `products.slug` existe en la BD (`page.tsx:31`) → sin Product/Offer, sin breadcrumbs y sin cobertura de búsqueda de larga cola ("hamburguesa doble Valledupar") | Alto | L |
| S12 | Ficha de Google Business Profile (enlace + NAP coherente) | **NO VERIFICABLE** | No hay ningún enlace a GBP en `src/`. El único dato de contacto en BD es `instagram_url=https://www.instagram.com/tetsu.burger/` y `address=''` → sin NAP no se puede enlazar ni verificar coherencia | Alto | S (datos) + M (enlace + JSON-LD) |
| S13 | `noindex` en páginas administrativas y de confirmación | **NO CUMPLE** | Verificado: `/admin/login` y `/pedido/confirmado?t=abc123` **no** emiten `<meta name="robots">` (solo el 404 nativo de Next lo lleva). El panel es privado pero indexable, y la confirmación contiene un token de pedido en la URL | Medio | S |
| S14 | Enlazado interno | **NO CUMPLE** | El HTML del home no contiene **ningún** `<a href>` interno: los únicos href son `/`, `/favicon.ico`, `/images/logo.webp` y `/_next/static/*`. No hay navegación por categorías, ni migas de pan, ni enlaces desde el footer | Alto | M |

### 4.4 Imágenes y rendimiento

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| I1 | `alt` en todas las imágenes y uso de `next/image` | **CUMPLE** | 0 etiquetas `<img>` en todo `src/`; 9 usos de `next/image` y **los 9 con `alt` y con `sizes`** (el logo usa `width/height`, correcto para una imagen no-`fill`) | Bajo | S |
| I2 | Formatos AVIF | **NO CUMPLE** | `next.config.ts:21-29` define `remotePatterns` pero **no** `images.formats` → Next solo negocia WebP | Medio | S |
| I3 | Peso por imagen de producto | **NO CUMPLE** | HEAD a las 9 imágenes de Supabase: **5 127 KB totales (promedio 570 KB)**. Tres pesan **1,5–1,6 MB**: `Perro classic` 1 614 KB, `Combo #1` 1 584 KB, `Perro Tetsu` 1 563 KB (y son precisamente las destacadas que aparecen primero). El optimizador de Next las re-codifica, pero el *origin fetch* de 1,6 MB por imagen penaliza TTFB y costo de la CDN | Alto | M |
| I4 | Banner/hero | **PARCIAL** | `public/images/bannerTetsu.webp` = 1920×1080, **515 KB** en WebP **lossless** (VP8L). Lighthouse `uses-responsive-images` (score 0,5): en escritorio de 1340 px se sirve `w=1920` → **70 % de bytes desperdiciados** | Medio | S |
| I5 | LCP móvil | **PARCIAL** | Lighthouse móvil: **LCP 3,5 s (score 0,63)** con reparto 62 % *Load Delay* / 24 % TTFB / 9 % carga / 6 % render. El elemento LCP es el `<img>` del hero (`page.tsx:230-237`) y la auditoría `lcp-discovery-insight` marca `priorityHinted: false` → falta `fetchPriority="high"` | Alto | M |
| I6 | `next/font` y peso de fuentes | **PARCIAL** | `src/app/layout.tsx:8-24` usa Plus Jakarta + Anton + Geist Mono (subconjunto latin, `display: swap`) ✓. Pero **Geist Mono solo se usa en el admin** (`inventory-manager.tsx:149`, `production-manager.tsx:264`, `info-tip.tsx:55`) y se precarga en todas las páginas públicas: **63 KB de fuentes en 3 requests** en cada visita | Bajo | S |
| I7 | JS innecesario en cliente | **PARCIAL** | El home carga **16 chunks = 807 KB sin comprimir / 224 KB transferidos** (CSS 20 KB, imágenes 95 KB, fuentes 63 KB → **420 KB totales**, `total-byte-weight`). Auditorías: `unused-javascript` (26 KB desperdiciados, chunk de 71 KB con 37 % sin usar), `legacy-javascript` (13 KB, bundle `noModule` de 110 KB) | Medio | M |
| I8 | `html5-qrcode` no contamina el bundle público | **CUMPLE** | El chunk de 364 KB con `html5-qrcode` (`01hdrw9ndv8hc.js`) **no** se referencia en el HTML del home ni en `/admin/login` → code-splitting correcto | Bajo | S |

### 4.5 UX y accesibilidad

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| U1 | **Contraste WCAG AA** | **NO CUMPLE** | Lighthouse `color-contrast` = **32 elementos** (móvil y escritorio). Detalle medido: `text-primary-foreground` (#fafafa) sobre `--primary` (#ff6633) = **2,79:1** (exige 3:1 incluso en texto grande) → afecta los números de orden "01/15/02/51" del hero y el chip activo "Destacados" (2,91:1); `#ff6633` sobre blanco = **2,91:1** → afecta **todos los precios** ("$20.000", "$23.000"…); `--muted-foreground` (#737373) sobre `--muted` (#f5f5f5) = **4,35:1** → exige 4,5:1 → afecta los badges "2 opciones". Tokens en `src/app/globals.css:60-65`. Lighthouse a11y = **0,90** | Alto | S |
| U2 | Botón sin nombre accesible (móvil) | **NO CUMPLE** | Lighthouse `button-name` = 0 en móvil: el botón del carrito (`src/components/public/header.tsx:112-124`) solo muestra el texto "Carrito" dentro de `className="hidden sm:inline"` → a <640 px **no hay texto visible ni `aria-label`** | Medio | S |
| U3 | `label-content-name-mismatch` (WCAG 2.5.3) | **NO CUMPLE** | `src/components/public/product-reviews.tsx:304-308`: el `aria-label` (`"Ver reseñas de ${productName}"`) **reemplaza** el texto visible ("5.0 (2 reseñas)" / "Sé el primero en calificar") → el nombre accesible no contiene la etiqueta visible. Lighthouse lo marca en los 6 productos del home | Medio | S |
| U4 | Áreas táctiles | **PARCIAL** | Tamaños base de `Button` (`src/components/ui/button.tsx:24-34`): `h-8`=32 px, `sm`=28 px, `lg`=36 px, `icon`=32 px. El "+/−" del carrito usa `size-7`=**28 px** (`header.tsx:67,77`); "Agregar" usa `size="default"`=**32 px** (`product-card.tsx:219-220`). Bajo el mínimo cómodo de 44 px y apenas sobre el mínimo AA de 24 px | Medio | M |
| U5 | 404 / error / loading personalizados | **NO CUMPLE** | No existen `not-found.tsx`, `error.tsx` ni `loading.tsx` en `src/app`. El 404 sirve la página por defecto de Next **en inglés**: "404 / This page could not be found." (verificado en el HTML). No hay `error.tsx` para fallos de Supabase | Medio | S |
| U6 | Estados vacíos | **PARCIAL** | Hay estado vacío del carrito (`header.tsx:24-32`), de reseñas (`product-reviews.tsx:487-491`) y de checkout (`checkout-form.tsx:32-41`), pero **no hay estado vacío para el home sin productos** ni para el resumen sin items (cae en el 404-style genérico de Next) | Bajo | S |
| U7 | Responsive 320 / 375 / 768 / 1280 px | **NO VERIFICABLE** | Lighthouse móvil corrió a 412 px. No hay pruebas automatizadas de viewport; los chips de categorías usan scroll horizontal (`menu-sections.tsx:259 overflow-x-auto`), lo que suele romper a 320 px | Medio | S |
| U8 | Foco visible y teclado | **PARCIAL** | `button.tsx:8` define `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` ✓. Faltan: reglas `prefers-reduced-motion` (0 coincidencias en `globals.css`) y verificación del orden de tabulación en el overlay de hoja inferior del nuevo modal de reseñas | Bajo | S |
| U9 | Accesibilidad de las reseñas (nuevo modal) | **CUMPLE** | `StarPicker` con `role="radiogroup"`, roving tabindex, flechas/Home/End, `aria-label` por estrella y etiqueta `aria-live` (`src/components/ui/star-rating.tsx`); cierre del modal de 44 px; formulario en segundo paso sin autofocus | Bajo | S |

### 4.6 Formularios

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| F1 | Validación en servidor con zod | **CUMPLE** | `src/features/orders/actions.ts:24-40` (nombre, teléfono con regex, dirección condicional, honeypot), `src/features/reviews/actions.ts:74-81` (uuid de producto, comentario ≤1000, nombre 2–80), `src/features/orders/manual-actions.ts:15-32`, `src/features/caja/schema.ts`, `src/features/expenses/schema.ts`, `src/features/products/schema.ts`. Además valida el token de pedido (`reviews/actions.ts:111`) | Bajo | S |
| F2 | Honeypot | **CUMPLE** | Checkout: `checkout-form.tsx:110-117` + `orders/actions.ts:34-35,52-54` (falso positivo en silencio). Reseñas: campo `website` en `product-reviews.tsx` + `reviews/actions.ts:80-81,95` | Bajo | S |
| F3 | CAPTCHA (Turnstile / reCAPTCHA) | **NO CUMPLE** | No hay Turnstile, reCAPTCHA ni hCaptcha en `package.json` ni en el código. El único control anti-bot es honeypot + rate limit (ambos evadibles) sobre formularios que **crean pedidos y reseñas** | Medio | M |
| F4 | **Rate limit persistente** | **NO CUMPLE** | `src/lib/rate-limit.ts:11` → `const store = new Map<string, RateLimitEntry>()` en memoria del proceso; el comentario en `:3` lo reconoce ("single-instance Next.js deployment on Vercel"). Se pierde en cada despliegue y **no se comparte entre réplicas**: en Vercel (serverless, N instancias) el límite real es N× el configurado. Afecta login (5/15 min), pedidos (10/10 min) y reseñas (15/10 min) | Alto | M |
| F5 | Mensajes de error útiles | **CUMPLE** | Zod con mensajes en español y `toast.error(result.error)` propagando el mensaje del servidor (`checkout-form.tsx:79-88`, `product-reviews.tsx:272`) | Bajo | S |
| F6 | Botón deshabilitado + protección contra doble envío | **CUMPLE** | `checkout-form.tsx:45` (`if (submitting) return`) y `:231` (`disabled={submitting || isPending}`); reseñas con estado `sending` y `disabled` en todos los controles | Bajo | S |

### 4.7 Conversión

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| V1 | **Botón de WhatsApp visible en móvil y escritorio** | **NO CUMPLE** | El único uso de `wa.me` se genera **después** del pedido (`src/features/orders/actions.ts:159`) y se muestra en `/pedido/confirmado` (`confirmado/page.tsx:45-51`). **No existe ningún botón de WhatsApp** en el home, `/resumen` ni `/checkout` (grep `wa.me|whatsapp` → solo `src/lib/whatsapp.ts`, `orders/actions.ts`, `confirmation-actions.ts`, `settings/actions.ts`). El número sí está configurado en BD (`whatsapp_number=573044243650`) | Alto | S |
| V2 | Una sola llamada a la acción primaria por pantalla | **NO CUMPLE** | En el home compiten: botón del carrito en el header (`header.tsx:113`), botón flotante "Ver pedido" (`floating-cart-button.tsx:15-28`), un **"Agregar" por producto** (`product-card.tsx:219`) y un **"Calificar" por producto** (`product-reviews.tsx:290-313`). El hero **no tiene CTA** (`page.tsx:242-262` solo texto) → no hay jerarquía | Medio | M |
| V3 | Analítica instalada (GA4 / Plausible / Vercel Analytics) | **NO CUMPLE** | `package.json` no incluye `@vercel/analytics`, `next-plausible` ni `react-ga4`; 0 scripts de analítica en `src/`; el HTML servido no carga ningún script de terceros (las 16 peticiones JS son todas de `/_next/static`) → **no se puede medir nada** | Alto | M |
| V4 | Analítica bloqueada hasta consentimiento | **NO CUMPLE** | No hay banner ni mecanismo de consentimiento (ver L3). Hoy no hay cookies de terceros, así que no hay infracción activa, pero cualquier GA4 debe quedar tras el consentimiento | Alto | M |
| V5 | Eventos de conversión | **NO CUMPLE** | Sin analítica no existen `view_item`, `add_to_cart`, `begin_checkout` ni `generate_lead`. El único evento "conversión" real es la creación del pedido en Supabase | Medio | M |

### 4.8 Seguridad y calidad

| # | Punto | Estado | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|---|
| Q1 | Secretos en `.env` y no versionados | **CUMPLE** | `.env.local` contiene 3 variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); `.gitignore:34` cubre `.env*`; `git ls-files --error-unmatch .env.local` → error (no trackeado); el historial no contiene archivos `.env*`; la service role nunca llega al cliente (`import "server-only"`) | Bajo | S |
| Q2 | `npm audit` / superficie de vulnerabilidades | **PARCIAL** | 21 vulnerabilidades (2 críticas, 15 altas, 4 moderadas) sobre el lockfile: `next` (directa, crítica), `eslint-config-next` (directa, alta), `shadcn` (directa, alta) y 15 transitivas (`undici` ×10, `brace-expansion`, `micromatch`, `sharp`, `proxy-addr`, `source-map-js`, `js-yaml`, `fast-uri`, `@modelcontextprotocol/sdk`, `@ts-morph/common`). `fixAvailable` de `next` = 16.4.2, sin salto de major | Alto | S |
| Q3 | Permisos/RLS en la base de datos | **CUMPLE** | Verificado con consultas REST reales comparando anon vs service_role (ver fila L7). Sin ningún `select` anónimo fuera de `settings.is_public` y `product_reviews.status='APROBADO'` | Bajo | S |
| Q4 | RBAC del panel | **CUMPLE** | Defensa en 3 capas: `src/proxy.ts:28-30` (matcher `/admin/:path*`) → `src/lib/supabase/middleware.ts:40-49` (redirige a `/admin/login` si no hay `getUser()` válido) → `src/app/admin/(protected)/layout.tsx:15-35` (exige sesión **y** fila en `profiles`). Las mutaciones con service role exigen `checkStaff` (`reviews/actions.ts:259`, `closings/actions.ts`, `board-actions.ts`, `consumption-actions.ts`, `manual-actions.ts:4`). Los export CSV también validan sesión (`export/pedidos/route.ts:16-21`) | Bajo | S |
| Q5 | Errores de TypeScript / ESLint | **CUMPLE** | `npx tsc --noEmit` exit 0; `npm run lint` 0 errores; `npm run build` compila sin warnings | Bajo | S |
| Q6 | Tests automatizados | **NO CUMPLE** | `package.json:5-10` no define script `test`; 0 archivos `*.test.*` / `*.spec.*` en `src/`; no hay CI | Medio | L |
| Q7 | Observabilidad / logging | **PARCIAL** | Solo 4 `console.error` sin servicio centralizado ni correlación: `product-reviews.tsx:189,272`, `post-order-reviews.tsx:55`, `reviews/actions.ts:148`. No hay reporte de errores (Sentry/OTel), así que los fallos de producción no se detectan | Bajo | M |
| Q8 | Caducidad de la sesión del panel | **NO VERIFICABLE** | No se declara `expiresIn`/refresh de sesión de Supabase en `src/lib/supabase/*`; el comportamiento por defecto de `@supabase/ssr` es 1 h con refresh automático | Bajo | S |

---

## 5. Lista priorizada de correcciones (lotes, uno por PR)

### 🔴 Lote 0 — Parche de emergencia (bloqueante, 30 min)
> Elimina 2 RCE sin autenticación y reduce la superficie expuesta. **Va primero, hoy.**
1. `npm i next@16.4.2` (cierra `GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4`, `GHSA-vcvr-r3jv-pc5j`, `GHSA-cjq9-62q9-8jv4`, `GHSA-3w37-wq28-93x7`, `GHSA-4jqv-mc3x-m676`, `GHSA-mcj8-r9mp-w47p`, `GHSA-f87g-xv8r-7p7x`). Verificar con `npm audit --package-lock-only`.
2. `next.config.ts`: añadir `poweredByHeader: false` (T7), bajar `serverActions.bodySizeLimit` a `"1mb"` (T9) y **retirar** `X-XSS-Protection` (T8).
3. Regenerar `package-lock.json` en limpio (`rm -rf node_modules package-lock.json && npm i`) para eliminar los 6 paquetes extraneous y que `npm audit` vuelva a funcionar (T6).
4. `npm audit fix` para lo transitivo; `shadcn` y `eslint-config-next` solo afectan a dev.

### 🔴 Lote 1 — Legal y cumplimiento (bloqueante para operar en Colombia)
> Es el hallazgo de mayor riesgo del proyecto: el sitio ya recolecta datos personales sin ninguna base legal ni aviso.
1. Crear `src/app/(legal)/privacidad/page.tsx`, `/terminos/page.tsx`, `/cookies/page.tsx` con textos redactados a partir de los datos del dueño (sección 6) y **metadatos `noindex`** para no competir con el home.
2. Añadir `src/app/(legal)/privacidad` enlazado desde: pie de `src/app/page.tsx:269-276` y del checkout (`src/components/public/checkout-form.tsx:242-245`).
3. **Casilla de consentimiento** en el checkout (datos de contacto) y en el formulario de reseñas, con enlace a la política y registro del consentimiento (`accepted_terms_at`, `policy_version`) en `orders` y `product_reviews`.
4. **Banner de cookies** (`src/components/ui/cookie-banner.tsx`) con "Aceptar / Rechazar / Configurar", persistiendo la decisión en `localStorage` (o cookie `consent`) y **bloqueando la carga de analítica hasta aceptar** (dejar el punto de integración listo para el Lote 6).
5. Sección **PQR** (canal, correo, formulario, tiempos de respuesta) en el pie y en `/privacidad`.
6. Pie con los **datos del titular** (razón social, NIT, dirección, correo, teléfono) y enlaces a las políticas, desde los `settings` existentes (`address` está vacío: `settings-form.tsx` ya los edita).
7. Replicar en `supabase/migrations/00XX_rls_policies.sql` **todas** las políticas RLS verificadas en producción (hoy no están versionadas) (L7).

### 🟠 Lote 2 — Seguridad de aplicación
1. **CSP**: `Content-Security-Policy` con `default-src 'self'`, `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (o nonce), `img-src 'self' data: blob: https://*.supabase.co`, `connect-src 'self' https://*.supabase.co`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `upgrade-insecure-requests`. Desplegar en modo `Content-Security-Policy-Report-Only` primero (T1).
2. **Rate limit persistente**: tabla `rate_limits` en Supabase (o Upstash Redis) con ventana deslizante; `src/lib/rate-limit.ts` deja de usar `Map` en memoria. Afecta login, pedidos y reseñas (F4).
3. **Turnstile** en el formulario de pedidos (y opcionalmente en reseñas) (F3).
4. **Privatizar el repositorio** de GitHub y revisar el historial por si el service role se filtró en algún momento (T11).
5. **Forzar HTTPS y canonicalizar www/no-www** en el hosting (una sola versión pública) y declarar `metadataBase` (T2, T3).

### 🟠 Lote 3 — SEO técnico (impacto alto, esfuerzo bajo)
1. `src/app/layout.tsx`: `metadataBase` (URL real), `title: { default, template }`, `description` de 140–160 caracteres con "Valledupar", categoría, teléfono y llamada a la acción; `alternates.canonical`; `openGraph` + `twitter` (imagen 1200×630, `summary_large_image`); `robots` por ruta.
2. `metadata` por página: home (con ubicación y horarios), `/checkout` (hoy sin description propia: `checkout/page.tsx:6-7` solo define `title`), `/resumen`, `/pedido/confirmado` (con `noindex`), `/admin/**` (con `noindex`).
3. `src/app/robots.ts` (permitir `/`, bloquear `/admin/`, `/pedido/confirmado`, `/resumen`, `/checkout`; declarar `Sitemap:`).
4. `src/app/sitemap.ts` con la home y, cuando exista el Lote 5, las páginas de producto y de categorías.
5. `src/app/manifest.ts` + `public/apple-touch-icon.png` (180×180) + `metadata.appleWebApp`.
6. `lang="es-CO"` en `src/app/layout.tsx:42`.
7. Un `<h1>` garantizado en `/resumen` (también en el estado de carrito vacío) (S5).

### 🟠 Lote 4 — Datos estructurados y presencia local
1. **JSON-LD `Restaurant`** (o `LocalBusiness` + `FoodEstablishment`) en el home: `name`, `image`, `address` (calle, barrio, `addressLocality: "Valledupar"`, `addressRegion: "Cesar"`, `addressCountry: "CO"`), `geo`, `telephone`, `openingHoursSpecification` (derivado de `business_hours`), `priceRange`, `servesCuisine`, `hasMenu`, `url`, `sameAs` (Instagram).
2. **JSON-LD `Menu` + `ItemList`** con productos, precio y disponibilidad; **`Offer`** con `priceCurrency: "COP"`; **`BreadcrumbList`** cuando existan páginas por categoría.
3. **Páginas de producto** `/producto/[slug]` (`products.slug` ya existe): URL indexable, `Product` + `Offer` + `AggregateRating` (usando solo reseñas `APROBADO` y con `reviewCount` real), migas de pan, y enlaces internos desde el home (esto también resuelve el enlazado interno inexistente, S14).
4. **Google Business Profile**: enlace al perfil en el pie (y `sameAs`), NAP **idéntico** al de la web y al JSON-LD (misma dirección, mismo teléfono) — depende de los datos de la sección 6.

### 🟡 Lote 5 — Core Web Vitals
1. **Quitar `force-dynamic`** de `src/app/page.tsx:16` y usar ISR + `revalidatePath`/tag de revalidación al cambiar productos/ajustes/horarios → elimina el `Cache-Control: no-store` y los 820 ms de TTFB en cada visita (T10). Alternativa mínima: cachear en el edge con `unstable_cache` para `settings`, `business_hours` y `categories`.
2. **AVIF** en `next.config.ts` (`images.formats: ["image/avif","image/webp"]`) (I2).
3. **Recomprimir**: banner a WebP lossy ~120 KB (o AVIF) manteniendo 1920×1080 (I4); las 3 imágenes de 1,5 MB de Supabase a <150 KB (I3); usar `src/lib/compress-image.ts` (ya existe en el repo) en el flujo de subida.
4. **`fetchPriority="high"`** en la imagen LCP del hero + `sizes` más precisa (`100vw` está bien, pero el `srcset` debe ofrecer el ancho correcto) (I5).
5. **Quitar Geist Mono del bundle público** (solo se usa en el admin) → −20 KB por visita (I6).
6. Revisar el chunk `noModule` de 110 KB (legacy-javascript) y el `unused-javascript` de 26 KB (I7).

### 🟡 Lote 6 — Accesibilidad y UX
1. **Contraste** (U1): redefinir `--primary` de `oklch(0.698 0.197 38)` a un naranja que alcance ≥4,5:1 con blanco (p. ej. `#c2410c` → **5,18:1** medido) o usar texto casi negro sobre el naranja actual (7,2:1); subir `--muted-foreground` a ≥4,5:1 sobre `--muted`. **Revisar visualmente la marca** antes de aplicar (el naranja actual es el ADN de la marca) → alternativa de bajo impacto: cambiar solo `--primary-foreground` a `#1a0f08` (texto oscuro sobre naranja) y oscurecer el naranja usado como **texto** (precios) a `#c2410c`.
2. **`aria-label` en el botón del carrito** móvil (`header.tsx:112-124`) (U2).
3. **Corregir `label-content-name-mismatch`**: incluir el texto visible en el `aria-label` en `src/components/public/product-reviews.tsx:304-308` (U3).
4. **Áreas táctiles ≥44 px** en los controles críticos: `+ / −` del carrito (28 px), "Agregar" (32 px), chips de filtros y de sección (U4).
5. **`not-found.tsx`, `error.tsx`, `loading.tsx`** propios, en español y con marca (U5).
6. `prefers-reduced-motion` en `globals.css` y verificación de foco/tabulación en el modal de reseñas (U8).
7. Estado vacío del home sin productos y del resumen sin items (U6).

### 🟡 Lote 7 — Conversión y medición
1. **Botón de WhatsApp fijo** (móvil y escritorio), con mensaje prellenado desde `src/lib/whatsapp.ts` (`buildWhatsappMessage` ya existe; crear un mensaje de consulta con el menú/carta), `aria-label` descriptivo y `rel="noopener"`, visible también con carrito vacío (V1).
2. **Jerarquía de CTA**: CTA principal en el hero ("Pedir por WhatsApp" / "Ver el menú"), "Agregar" como acción secundaria y el botón flotante de carrito solo cuando el carrito tenga items (V2).
3. **Analítica** (Plausible o Vercel Analytics) **cargada solo tras el consentimiento** del Lote 1 (V3, V4).
4. **Eventos**: `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `generate_lead` (pedido enviado) y `review_submitted` (V5).

### 🔵 Lote 8 — Calidad (backlog)
1. Tests: Vitest para `src/lib/*` (formato, pricing, business-hours, addons, bogota) y Playwright para los flujos críticos (pedido completo, envío de reseña, moderación en admin) (Q6).
2. `console.error` → servicio centralizado de reporte de errores (Sentry/OTel) (Q7).
3. Rotar `SUPABASE_SERVICE_ROLE_KEY` si el repo estuvo público más tiempo del aceptable y verificar en el panel de Supabase el log de accesos.
4. Documentar el dominio real y el flujo de despliegue (`GUIA_DE_USO.md:21` sigue con `tudominio.com`).

---

## 6. Datos que necesito del dueño

> Bloquean los Lotes 1 (legal), 4 (JSON-LD/GBP) y 7 (WhatsApp). Ninguno se puede inventar.

**Identificación y datos del titular (obligatorio para el aviso legal y el JSON-LD)**
1. Razón social completa (p. ej. "TETSUBURGER S.A.S." / "TETSUBURGER" como nombre comercial) y **NIT**.
2. Dirección exacta del local: calle + número, barrio, municipio (**Valledupar**), departamento (Cesar), referencia, y **coordenadas GPS** (`-lat, -lng`).
3. Teléfono fijo y **WhatsApp** de atención (confirmar si `573044243650` es el número público de pedidos) y un segundo número (reservas/domicilios).
4. Correo de contacto, correo de **privacidad/tratamiento de datos** y correo de **PQR** (¿sirve `tetsuburger@gmail.com`? ese correo está en `GUIA_DE_USO.md:281`).
5. Persona o empresa responsable del tratamiento de datos y, si aplica, nombre del encargado/DPO.
6. Datos de facturación (resolución de facturación, regime, actividad económica) para completar el aviso legal.

**Operación**
7. **Horarios reales por día** y días de cierre (¿coinciden con lo configurado en el panel → `business_hours`?), y si hay horario especial de desayuno/almuerzo.
8. Radio o cobertura de domicilio y zonas no servidas (hoy la web solo dice que la tarifa "puede variar").
9. Métodos de pago aceptados: efectivo, transferencia, Nequi, Daviplata, Bancolombia… y los **datos de cuenta** que se muestran al cliente (hoy `whatsapp.ts:33` solo dice "Transferencia").
10. ¿Se cobra por adelantado? ¿Hay pedido mínimo y horario de cierre de pedidos (corte de cocina)?
11. Política de cambios/cancelaciones/reembolsos y de entrega fallida.

**Presencia digital y medición**
12. **URL del perfil de Google Business Profile** (o los datos exactos para crearlo: dirección, categoría principal, teléfono, horario, sitio web).
13. Confirmar si `https://www.instagram.com/tetsu.burger/` es la cuenta oficial; ¿hay Facebook, TikTok o YouTube? (`facebook_url` está vacío).
14. **Dominio de producción** y si el sitio se publica con `www` o sin `www` (necesario para canonical y redirecciones).
15. Preferencia de analítica: **GA4** (ID `G-XXXX`), **Plausible** (dominio), **Vercel Analytics** o **Ninguna**. Confirmar que se acepta que se cargue tras el consentimiento.
16. ¿Se puede añadir el botón "Añadir a pantalla de inicio" (PWA) y un `apple-touch-icon` con el logo? (ya existe `public/images/logo.webp`).

**Otros**
17. ¿Se usan cookies de terceros hoy fuera del panel (Supabase Auth)? (hoy no hay ninguna cookie en el sitio público — verificado).
18. Retención deseada de los pedidos y datos de clientes por motivos contables/fiscales (p. ej. 5 años) — hay 236 pedidos con nombre, teléfono y dirección.
19. Existe una política de devoluciones/garantía (alimentos) y un aviso de alérgenos/ingredientes que deba mostrarse en cada producto (hoy `products.description` es el único campo libre).

---

## 7. Riesgos y dudas

1. **El dominio de producción es desconocido** (`GUIA_DE_USO.md:21` usa `tudominio.com`; no hay `.vercel` en el repo). Todo lo relativo a HTTPS forzado, www/no-www, `metadataBase`, sitemap, robots y ficha de GBP queda **NO VERIFICABLE** y las recomendaciones asumen que la web está en Vercel con el proxy activo.
2. **Lighthouse se ejecutó en local** (`next start` en Windows, sin CDN ni edge de Vercel): el TTFB de 820 ms refleja consultas a Supabase desde el servidor local, no la latencia real de producción. El LCP móvil de 3,5 s **puede mejorarsubstantivamente** solo con ISR/edge cache; no se debe Optimize sin repetir la medición en el dominio real.
3. **`npm audit` no es ejecutable sobre `node_modules`** por el árbol inválido (6 paquetes extraneous de sharp-wasm). Las cifras de vulnerabilidades provienen de `npm audit --package-lock-only` sobre el lockfile, que es la fuente correcta, pero conviene regenerar el lock antes de aplicar `npm audit fix`.
4. **Matiz de la RCE crítica de Next**: `GHSA-p293-qw3h-jr36` aplica específicamente a **servidores autoalojados en Windows** (este equipo de desarrollo). Si el despliegue es Vercel (Linux), ese vector no se materializa; **pero** `GHSA-2xp9-vwfh-vxw4` (RCE en la API de optimización de imágenes cuando se usan archivos AVIF) sí puede afectar a cualquier hosting, y hoy `images.formats` no incluye AVIF (lo que casualmente reduce la exposición mientras no se parchee). El Lote 0 cierra ambos.
5. **RLS: CORREGIDO.** La auditoría inicial dio por hecho que las políticas solo existían en el panel de Supabase. Al ejecutar `0027_legal_consent_pqr.sql` y `scripts/check-rls-coverage.mjs` se confirmó que **las 28 tablas tienen RLS versionado** en `supabase/migrations/` (`npm run check:rls` → 28/28). Era un **falso positivo**: no hay que versionar políticas nuevas, solo aplicar `0027` y `0028` en el proyecto real.
6. **El repositorio es público.** Aunque verifiqué que no hay secretos en el historial y `.env.local` está ignorado, exponer públicamente la lógica de negocio, los esquemas de base de datos y las Server Actions facilita ataques de ingeniería social (phishing de credenciales de Supabase) y es innecesario para un negocio privado. Recomiendo privatizarlo y rotar la service role.
7. **No se puede redactar el aviso legal sin los datos del dueño** (sección 6). Se puede preparar la estructura y los textos tipo, pero razón social, NIT, dirección,finalidades, retenciones y canal PQR deben ser los reales: un texto con datos inventados es peor que no tener política.
8. **El contraste del naranja es una decisión de marca, no solo técnica.** El naranja `#ff6633` es el ADN visual de TETSUBURGER y el usuario pidió explícitamente no alterar la identidad visual. La corrección mínima que **no cambia el naranja de marca** es: `--primary-foreground` → texto muy oscuro (`#1a0f08`, 7,2:1) para botones y chips, y un naranja de texto más oscuro (`#c2410c`, 5,18:1) para precios y enlaces. Debe validarse visualmente antes de aplicar.
9. **La auditoría no cubre el panel admin en profundidad** (contraste, teclado, formularios y permisos de cada módulo): se revisó la autenticación, el RBAC y los endpoints de exportación, no la usabilidad de los 18 módulos administrativos. Queda como segunda fase.
10. **No se evaluó el comportamiento real del modal de reseñas reescrito** (bottom sheet móvil, teclado, `visualViewport`) ni del sistema de filtros/orden/distribución: es código de esta misma sesión, verificado solo por compilación, lint y la lógica de consultas contra la base real.
11. **El 404 por defecto de Next viene en inglés** y sin marca: además del impacto de conversión, `/_not-found` es la única ruta con `noindex` automático, lo que confirma que ninguna otra ruta declara robots.
12. **Los 32 fallos de contraste y el `button-name` son reproducibles en la web pública**, por lo que son hallazgos verificables por un tercero (y potencialmente reportados en herramientas de accesibilidad o como riesgo de cumplimiento en unequipo de auditoría externo).

---

## 9. Estado de ejecución

**Fecha de cierre:** 22 de octubre de 2026. Todo se verificó en local con
`npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` y smoke tests
con `next start`. Lo que depende del entorno real (dominio, claves, migraciones)
queda documentado como pendiente del dueño.

| Lote | Rama | Commit(s) | Resultado |
| --- | --- | --- | --- |
| 0 — Parches | `fix/lote-0-parches` | `823235c` | `next@16.4.2`, lock regenerado, `poweredByHeader:false`, límites de subida |
| 1 — Legal | `fix/lote-1-legal` | `c684099` | Privacidad, términos, cookies, PQR, consentimiento, marca TETSU BURGER |
| 2 — Seguridad | `fix/lote-2-seguridad` | `b129b11` | Rate limit persistente, Turnstile, CSP report-only, migración `0028` |
| 3 — SEO | `seo/lote-3-metadatos` | `ed56725`, `3e2de51`, `3e26297` | Metadata, canonical, OG dinámico, robots, sitemap, manifest, iconos |
| 4 — Datos estructurados | `seo/lote-4-datos-estructurados` | `cff5cb3` | `Restaurant`, `Menu`, `Product`, breadcrumbs y 9 páginas de producto SSG |
| 5 — Core Web Vitals | `perf/lote-5-cwv` | `7d91f8b` | ISR 300 s, AVIF, banner 515 KB → 19 KB, `fetchPriority`, fuente mono solo admin |
| 6 — Accesibilidad | `a11y/lote-6-ux` | `edee131` | Contraste AA, áreas táctiles, `aria-label`, 404/error/loading con marca, reduced motion |
| 7 — Conversión | `feat/lote-7-conversion` | `744ac3e` | CTAs del hero, WhatsApp flotante, eventos de analítica |
| 8 — Calidad | `test/lote-8-cierre` | (este commit) | Vitest con 24 pruebas de `src/lib/*`, `docs/DESPLIEGUE.md`, este estado |

### Hallazgos corregidos

- **Seguridad**: Next.js parcheado, rate limit atómico en Supabase, Turnstile,
  CSP en modo reporte, cabeceras endurecidas y `.env.example` completo.
- **Legal**: páginas de privacidad, términos, cookies y PQR, consentimiento
  explícito en checkout y reseñas, retención y derechos del titular
  documentados; sin banner de cookies por decisión del dueño (no hay cookies
  opcionales).
- **SEO**: metadatos únicos, canonical, Open Graph, `robots.txt`, `sitemap.xml`
  (14 URLs), manifest, `lang="es-CO"`, JSON-LD y páginas de producto indexables.
- **Rendimiento**: home y producto en ISR, imágenes AVIF/WebP, LCP priorizado y
  CSS/fuentes del admin fuera del bundle público.
- **Accesibilidad**: contraste AA en textos, precios y campos, objetivos
  táctiles de 40–44 px, nombres accesibles, foco visible, estados de
  carga/error/404 y `prefers-reduced-motion`. Los botones primarios conservan
  **texto blanco sobre el naranja de marca** por decisión explícita del dueño
  (identidad visual), aunque ese par no alcanza 4,5:1.
- **Conversión**: CTA principal en el hero, WhatsApp siempre visible y eventos
  `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `generate_lead` y
  `review_submitted`.

### Pendientes (no bloquean el código, dependen del dueño)

1. Aplicar `0027` y `0028` en Supabase y volver a correr `npm run check:rls`
   (28/28). Hasta entonces el rate limit funciona en memoria y PQR/consentimiento
   no persisten.
2. Definir dominio y `www`; cargar `NEXT_PUBLIC_SITE_URL` en Vercel.
3. Crear claves de producción de Turnstile y, si se desea, DSN de Sentry.
4. Confirmar los datos legales de la sección 6 (NIT, dirección, correo PQR,
   horarios, cobertura, medios de pago).
5. Completar Playwright para los flujos críticos (pedido, reseña, moderación) y
   conectar el reporte centralizado de errores. Los tests unitarios ya están en
   `npm test`.
6. Repetir Lighthouse contra el dominio real; el dato local no representa el
   edge de Vercel.

