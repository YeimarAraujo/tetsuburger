# Variables de entorno y despliegue en Vercel

> `NEXT_PUBLIC_*` se incrusta en el bundle del navegador: nunca pongas ahí
> secretos. `SUPABASE_SERVICE_ROLE_KEY` y `TURNSTILE_SECRET_KEY` son solo de
> servidor.

## Variables

| Variable | Producción | Preview | Desarrollo | Notas |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Real | Real | Real | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real | Real | Real | Pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | Real | Real | Real | **Secreta**; ignora RLS |
| `NEXT_PUBLIC_SITE_URL` | Dominio real | URL del preview (opcional) | `http://localhost:3000` | Sin slash final |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave real | Clave de prueba | Clave de prueba | Widget visible |
| `TURNSTILE_SECRET_KEY` | Clave real | Clave de prueba | Clave de prueba | Verificación servidor |

Si `NEXT_PUBLIC_SITE_URL` falta, `src/lib/site-url.ts` usa
`VERCEL_PROJECT_PRODUCTION_URL` y, en local, `http://localhost:3000`.

### Claves de prueba de Turnstile

Cloudflare publica claves que siempre pasan:

- Sitio: `1x00000000000000000000AA`
- Secreto: `1x0000000000000000000000000000000AA`

Úsalas en Preview y desarrollo. En Production crea el widget real y restringe
los dominios permitidos (`tudominio.com` y `www.tudominio.com`).

Si `TURNSTILE_SECRET_KEY` no está configurada, el servidor **omite** la
verificación y registra un aviso. Configúrala antes de abrir pedidos al público.

## Migraciones

Aplica `0028_rate_limits.sql` **antes** de desplegar este lote. Sin ella, el
rate limit cae al fallback en memoria (una sola instancia) y el login queda
protegido solo por instancia. Verifica con `npm run check:rls` y
`npm run verify:rls`.

## Región

`vercel.json` fija `regions: ["iad1"]` (por defecto). Cámbiala por la región de
tu proyecto de Supabase para reducir latencia:

1. Supabase → Project Settings → General → Region.
2. Ajusta `regions` en `vercel.json` (por ejemplo `["us-east-1"]` para
   `us-east-1`).
3. Redepliega.

En plan Hobby solo hay una región disponible.

## Dominio, HTTPS y www

- HTTPS y HSTS los gestiona Vercel; no se añaden redirecciones manuales.
- Elige una sola versión pública (con o sin `www`) en Vercel → Domains y
  redirige la otra desde ese panel.
- No se usan redirects `www` en `next.config.ts` para no duplicar la lógica.

## CSP

La cabecera se envía como `Content-Security-Policy-Report-Only` y los reportes
llegan a `/api/csp-report` (solo log). Cuando el log quede limpio:

1. Cambia el nombre de la cabecera a `Content-Security-Policy` en
   `next.config.ts`.
2. Mantén `report-uri` si quieres seguir recibiendo avisos.

No uses nonce: rompería el ISR. La política actual permite `'unsafe-inline'` y
`'unsafe-eval'` de forma consciente.

## Rate limit y firewalls

La tabla `rate_limits` cubre login, pedidos, reseñas, PQR y reportes CSP.
Como capa externa, puedes añadir una regla de **Vercel Firewall** para limitar
`POST /admin/login` por IP (acción manual, no requiere código).
