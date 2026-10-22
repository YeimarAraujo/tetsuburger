# Despliegue en producción

Guía para publicar TETSU BURGER en Vercel con Supabase. El dominio definitivo y
el titulo (con o sin `www`) los define el dueño; aquí se documenta el flujo y
los valores que dependen de esa decisión.

## 1. Requisitos

- Node.js 22 (el proyecto usa `next@16`).
- Proyecto de Supabase con las tablas del repositorio.
- Cuenta de Vercel con acceso al repositorio.
- Dominio comprado (se configura al final en Vercel → Settings → Domains).

## 2. Migraciones de base de datos

El repositorio no ejecuta DDL automáticamente. Aplica en el SQL Editor de
Supabase, en orden:

1. `supabase/migrations/0027_legal_consent_pqr.sql` — consentimiento, PQR y
   políticas RLS asociadas.
2. `supabase/migrations/0028_rate_limits.sql` — rate limit persistente
   (`consume_rate_limit`).

Después verifica que todas las tablas tengan RLS:

```powershell
npm run check:rls    # debe reportar 28/28
npm run verify:rls   # pruebas reales con anon vs service_role (requiere .env.local)
```

Si una migración falla, no continúes: el login y el rate limit quedan en modo
degradado.

## 3. Variables de entorno

Copia `.env.example` y completa los valores. En Vercel se configuran en
**Settings → Environment Variables**, por separado para **Production** y
**Preview**. La referencia completa está en `docs/VARIABLES_DE_ENTORNO.md`.

Mínimas para que el sitio funcione:

| Variable | Entorno | Nota |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ambos | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ambos | clave pública |
| `SUPABASE_SERVICE_ROLE_KEY` | ambos | **nunca** con prefijo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | Production | dominio final, p. ej. `https://tetsuburger.com` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ambos | opcional en desarrollo |
| `TURNSTILE_SECRET_KEY` | ambos | obligatorio si se activa Turnstile |

`NEXT_PUBLIC_SITE_URL` alimenta `metadataBase`, canonical, sitemap, robots y
Open Graph. Sin ella, Vercel usa `VERCEL_PROJECT_PRODUCTION_URL`; en local cae a
`http://localhost:3000`.

## 4. Primer despliegue

1. Importa el repositorio en Vercel (framework: Next.js, sin overrides de build).
2. Carga las variables de Production.
3. Despliega. El proyecto ya incluye `vercel.json` con cabeceras de seguridad.
4. En **Settings → Domains** agrega el dominio y decide `www` o raíz. Redirige
   la variante no elegida (Vercel lo hace con un redirect 308) y vuelve a
   desplegar para que `NEXT_PUBLIC_SITE_URL` coincida exactamente.
5. En **Settings → Web Analytics** habilita Web Analytics y Speed Insights.
   Ambos son cookieless y no requieren banner de consentimiento; el sitio ya
   envía eventos (`view_item`, `add_to_cart`, `view_cart`, `begin_checkout`,
   `generate_lead`, `review_submitted`).

## 5. Checklist posterior al despliegue

- [ ] `/` responde 200 y `cache-control` incluye `s-maxage=300`.
- [ ] `/sitemap.xml` lista 14 URLs (5 fijas + 9 productos) con el dominio final.
- [ ] `/robots.txt` permite el sitio público y bloquea `/admin`.
- [ ] `/producto/perro-clasic` responde 200; una URL inexistente muestra el 404
      con marca.
- [ ] El HTML incluye JSON-LD `Restaurant`, `Menu` y `Product`.
- [ ] WhatsApp flotante abre `wa.me` con mensaje prellenado.
- [ ] Pedido de prueba: guarda en Supabase, redirige a `/pedido/confirmado` y el
      botón de WhatsApp lleva el resumen.
- [ ] Turnstile bloquea envíos sin token (si está configurado).
- [ ] 6 intentos fallidos de login seguidos devuelven 429.
- [ ] `/pqr` guarda una solicitud y aparece en `/admin/pqr`.
- [ ] Consola sin errores de CSP (report-only) en home y checkout.
- [ ] Lighthouse móvil ≥ 90 en rendimiento y accesibilidad.

## 6. Rollback

Vercel conserva los despliegues: **Deployments → Promote to Production** sobre
el último despliegue estable. Las migraciones SQL no se revierten solas; si una
versión nueva requiere cambios de esquema, prepara el SQL de reversa antes.

## 7. Pendientes que dependen del dueño

- Dominio real y decisión `www`.
- Claves de producción de Turnstile.
- DSN de Sentry (hoy los errores solo van a `console.error`).
- Rotar `SUPABASE_SERVICE_ROLE_KEY` si el repositorio estuvo público y revisar
  el log de accesos en Supabase.
- Región de Supabase y de Vercel (para fijar `regions` en `vercel.json`).
