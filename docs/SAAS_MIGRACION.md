# TETSU BURGER — Migración a SaaS multi-tenant

**Fecha:** 26 de octubre de 2026  
**Estado:** propuesta técnica y de producto; no implementada todavía.  
**Repositorio:** `C:\Programacion\tetsuburger`  
**Rama de trabajo actual:** `fix/ajustes-ui` (incluye cambios recientes sin commit).  
**Objetivo:** convertir el catálogo virtual de un solo restaurante en una plataforma que se pueda vender a restaurantes, hamburgueserías, comidas rápidas y negocios de domicilio.

> Este documento es la fuente de contexto para las siguientes fases. No reemplaza una auditoría de seguridad formal ni una revisión legal. Los precios y tiempos son hipótesis a validar.

---

## 0. Resumen ejecutivo

TETSU BURGER tiene una base técnica sólida como aplicación de un solo negocio:

- Next.js 16, React 19, TypeScript, Tailwind v4 y Supabase.
- Pedidos web, checkout, confirmación por token, WhatsApp manual, reseñas verificadas.
- Inventario, consumos, compras, caja, cierres, finanzas, rentabilidad y exportaciones.
- Panel administrativo con autenticación, RLS, auditoría y Realtime.
- Legal, SEO, analítica, accesibilidad y 24 pruebas unitarias.
- Build, lint y TypeScript limpios.

Pero **no está preparada para operar varios restaurantes**:

- No existe el concepto de tenant.
- `is_staff()` da acceso global a cualquier perfil.
- La configuración, la numeración de pedidos y los slugs son globales.
- La marca, el WhatsApp, los correos y los metadatos están hardcodeados.
- No hay planes, suscripciones, onboarding, límites ni facturación SaaS.
- No hay POS, KDS, mesas, impresión térmica, fidelización, zonas de domicilio ni WhatsApp API.
- No hay CI, E2E, staging, backups documentados ni monitoreo centralizado.

**Recomendación:** migrar a una base compartida con `tenant_id` y RLS estricta, usando TETSU como tenant #1. No empezar con una base por cliente: multiplica el costo operativo antes de validar el negocio.

**Esfuerzo estimado:**

- Núcleo multi-tenant: 4–6 semanas.
- SaaS comercial con billing y onboarding: 4–6 semanas.
- POS + KDS + impresión: 6–10 semanas.
- Suite completa de la lista: 12–18 meses.
- MVP vendible con menú, pedidos, billing y POS básico: 4–6 meses con 2–3 personas.

---

## 1. Auditoría del estado actual

### 1.1 Fortalezas

| Área | Estado |
|---|---|
| Dominio del negocio | Pedidos, catálogo, adicionales, consumos, inventario, compras, caja, cierres y finanzas ya modelados |
| Seguridad | Auth de Supabase, RLS versionada en 28/28 tablas, roles ADMIN/OPERADOR y auditoría |
| Operación | Realtime para pedidos, alertas sonoras, tablero de cocina básico y exportaciones CSV |
| Calidad | `lint`, `tsc`, 24 tests y `build` pasan |
| Público | SEO técnico, JSON-LD, sitemap, robots, manifest, páginas de producto y 404 con marca |
| Legal | Privacidad, términos, cookies, PQR y consentimiento en checkout/reseñas |
| Conversión | WhatsApp flotante, CTAs, analítica y eventos |

### 1.2 Hallazgos críticos para SaaS

| ID | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| S1 | `is_staff()` es global | `supabase/migrations/0001_initial_schema.sql:265` | Cualquier staff vería datos de todos los tenants en una base compartida |
| S2 | `settings` usa `key` como PK global | `0001_initial_schema.sql:242` | No hay configuración por negocio |
| S3 | `order_number` es una identidad global | `0001_initial_schema.sql:95` | Los pedidos se numeran entre todos los restaurantes |
| S4 | Slugs únicos globales | `0001_initial_schema.sql:47`, `:60` | Dos negocios no pueden repetir “hamburguesas” o “combo-1” |
| S5 | Marca hardcodeada | `src/config/site.ts:11` y metadatos del layout | No se puede personalizar por tenant |
| S6 | Proxy solo protege `/admin` | `src/proxy.ts:33` | No hay resolución de tenant por dominio/subdominio |
| S7 | Storage compartido | Bucket `product-images` sin ruta por tenant | Riesgo de acceso cruzado y colisiones |
| S8 | `profiles` y roles globales | `0001_initial_schema.sql:34` | No existe membresía usuario↔tenant ni roles por negocio |
| S9 | Sin capa comercial | `package.json` no tiene billing, planes ni feature flags | No se puede cobrar ni limitar por plan |
| S10 | Sin POS/KDS/impresión | No hay rutas ni dependencias de POS, mesas o ESC/POS | Falta el módulo de mayor valor operativo |
| S11 | Rate limit con fallback en memoria | `src/lib/rate-limit.ts:21` | Si `0028` no está aplicada, no protege en múltiples instancias |
| S12 | Repo público y CSP en Report-Only | Configuración actual | Mayor superficie de reconocimiento y riesgo reputacional |
| S13 | Sin CI/E2E/staging | No existe `.github/` ni pruebas de flujo | Regresiones llegan a producción |
| S14 | Migraciones manuales | `docs/DESPLIEGUE.md` | Riesgo de entornos divergentes |
| S15 | Cambios recientes sin commit | `git status` | El historial no refleja el estado real del proyecto |

### 1.3 Deuda operativa

- Aplicar `0027_legal_consent_pqr.sql` y `0028_rate_limits.sql`.
- Confirmar dominio, `www` y variables de producción.
- Crear claves Turnstile de producción y DSN de Sentry.
- Rotar `SUPABASE_SERVICE_ROLE_KEY` si el repositorio estuvo público.
- Privatizar el repositorio.
- Configurar backups y restauración de Supabase.
- Crear staging separado de producción.
- Añadir Playwright para pedido, reseña, moderación y POS.
- Añadir Sentry u OpenTelemetry con `tenant_id` y `order_id` en el contexto.
- Documentar runbooks de caída, pedidos duplicados y restauración.

### 1.4 Bloqueadores actuales

1. Migraciones pendientes.
2. Dominio y variables de entorno sin definir.
3. Cambios locales sin commit.
4. Sin CI ni staging.
5. Sin pruebas de aislamiento multi-tenant.

### 1.5 Puntaje estimado

| Dimensión | Puntaje |
|---|---:|
| Producto single-tenant | 75–80 / 100 |
| Preparación SaaS | 25–30 / 100 |
| Operación y calidad | 50 / 100 |
| Escalabilidad comercial | Baja |

---

## 2. Visión del SaaS

### 2.1 Segmentos objetivo

1. **Cocinas ocultas y domicilios:** menú digital, WhatsApp y pedidos; no necesitan mesas.
2. **Hamburgueserías y comidas rápidas:** POS, cocina, inventario y domicilios.
3. **Restaurantes de mesa:** meseros, mesas, zonas, KDS y cuenta dividida.
4. **Franquicias y multi-sucursal:** dashboard central, precios por sucursal y roles.
5. **Eventos y ferias:** plan temporal con QR y pedidos.

### 2.2 Propuesta de valor

“Todo lo que un restaurante necesita para vender, cobrar y operar desde un solo lugar: menú digital con su marca, pedidos por WhatsApp, POS, cocina, inventario, domicilios y reportes.”

### 2.3 Principios

- **Tenant-first:** ninguna consulta, ruta, archivo o caché puede existir sin tenant.
- **Seguridad por defecto:** RLS, mínimo privilegio y pruebas de aislamiento.
- **Operación real:** el POS debe funcionar con internet inestable.
- **Implementación rápida:** onboarding en menos de 48 horas.
- **Precio claro:** sin comisiones ocultas; add-ons explícitos.
- **Verticalización:** plantillas para hamburguesería, pizza, sushi, café y comida rápida.

---

## 3. Arquitectura multi-tenant

### 3.1 Opciones

| Modelo | Aislamiento | Costo/operación | Recomendación |
|---|---|---|---|
| Base compartida + `tenant_id` + RLS | Medio-alto | Bajo | **Sí, para 1–500 tenants** |
| Esquema Postgres por tenant | Alto | Alto | No con Supabase por defecto |
| Proyecto Supabase por tenant | Muy alto | Muy alto | Solo Enterprise/franquicia |
| Híbrido | Alto | Medio | Base compartida + proyecto dedicado para Enterprise |

**Decisión:** base compartida con `tenant_id`, RLS estricta y pruebas automáticas. Los clientes Enterprise pueden recibir un proyecto dedicado más adelante.

### 3.2 Routing y dominios

- `app.tudominio.com` → panel de plataforma.
- `slug.tudominio.com` → menú y admin del tenant.
- `dominio-del-restaurante.com` → dominio propio del tenant.
- El proxy resuelve `host → tenant` y lo inyecta en el contexto.
- Los dominios personalizados se gestionan con Vercel Domains API y verificación DNS.
- `tenant_domains` guarda dominio, estado de verificación y tenant.

### 3.3 Autenticación y membresías

- Un usuario de Supabase Auth puede pertenecer a varios tenants.
- `memberships(user_id, tenant_id, role, status)`.
- Roles por tenant:
  - `OWNER`
  - `ADMIN`
  - `CAJERO`
  - `MESERO`
  - `COCINA`
  - `DOMICILIARIO`
- El panel de plataforma usa `platform_admins` separado.
- MFA opcional para owners y obligatorio para platform admins.
- Impersonación de soporte con auditoría y expiración.

### 3.4 RLS y aislamiento

- Agregar `tenant_id` a todas las tablas de negocio.
- Función `is_tenant_member(p_tenant_id uuid)` y `has_tenant_role(p_tenant_id uuid, p_roles text[])`.
- Todas las políticas deben incluir `tenant_id`.
- Prohibir `is_staff()` global en la nueva arquitectura.
- El service role solo se usa en jobs internos y plataforma.
- Pruebas obligatorias con dos tenants:
  - Tenant A no puede leer ni escribir datos de B.
  - Un usuario sin membresía no puede entrar.
  - Un cajero no puede modificar configuración.
  - Un mesero no puede ver finanzas.
- Tests SQL y E2E en CI.

### 3.5 Storage

- Bucket privado por tenant o ruta `tenant_id/productos/...`.
- Políticas por `tenant_id`.
- URLs firmadas para imágenes privadas.
- Validación de MIME, tamaño y compresión antes de subir.
- Limpieza de archivos huérfanos.

### 3.6 Caché y Realtime

- Claves de caché con `tenant_id`.
- Revalidación por tag `tenant:{id}:menu`, `tenant:{id}:settings`, etc.
- Realtime filtrado por `tenant_id`; nunca un canal global.
- ISR por tenant o render dinámico si el dominio es personalizado.

### 3.7 Panel de plataforma

- Lista de tenants, estado, plan, trial y uso.
- Crear/suspender tenant.
- Ver salud, errores y consumo.
- Gestionar dominios, planes y add-ons.
- Impersonar tenant con auditoría.
- Facturación SaaS y dunning.

### 3.8 Stack adicional recomendado

| Necesidad | Opción |
|---|---|
| Rate limit multi-instancia | Upstash Redis o Supabase `rate_limits` ya existente |
| Colas/cron | Supabase Cron + Edge Functions, Inngest o QStash |
| Email transaccional | Resend o Postmark |
| Errores | Sentry |
| Métricas | OpenTelemetry + Vercel Analytics |
| Billing | Wompi, Mercado Pago o PayU |
| WhatsApp | Meta WhatsApp Cloud API |
| Facturación electrónica | Siigo, Alegra o Factus |
| Impresión | QZ Tray, Star webPRNT o agente local |
| CI/CD | GitHub Actions + Vercel + Supabase CLI |

### 3.9 Modelo de datos nuevo

**Núcleo SaaS**

- `tenants`: id, slug, name, status, plan_id, trial_ends_at, created_at.
- `tenant_domains`: domain, tenant_id, verified_at.
- `memberships`: user_id, tenant_id, role, status.
- `tenant_settings`: tenant_id, key, value, is_public. PK `(tenant_id, key)`.
- `branches`: tenant_id, name, address, timezone, status.
- `plans`: code, name, price_cop, billing_period, features.
- `subscriptions`: tenant_id, plan_id, status, current_period_end.
- `billing_events`: provider, event_type, payload, processed_at.
- `usage_counters`: tenant_id, metric, period, count.
- `feature_flags`: tenant_id, feature, enabled, limit.
- `platform_admins`: user_id, role.

**POS y operación**

- `pos_sessions`: tenant_id, branch_id, opened_by, opened_at, closed_at, base_cash, expected_cash, counted_cash.
- `payments`: order_id, method, amount, tip, reference, status.
- `zones`: tenant_id, branch_id, name.
- `tables`: tenant_id, zone_id, name, capacity, qr_token.
- `table_sessions`: table_id, opened_at, closed_at, status.
- `discounts`: order_id, type, value, reason, approved_by.
- `tips`: order_id, amount, method.
- `refunds`: order_id, amount, reason, approved_by.
- `printers`: tenant_id, branch_id, name, type, connection, station.
- `print_jobs`: tenant_id, printer_id, payload, status, attempts.
- `kds_stations`: tenant_id, branch_id, name, categories.

**Inventario y proveedores**

- `suppliers`: tenant_id, name, contact, phone, email.
- `purchase_orders`: tenant_id, supplier_id, date, status, total.
- `purchase_items`: purchase_order_id, inventory_item_id, quantity, unit_cost.
- `inventory_lots`: tenant_id, item_id, quantity, unit_cost, expires_at.
- `stock_counts`: tenant_id, date, status, created_by.

**Domicilios**

- `delivery_zones`: tenant_id, name, fee, min_order, polygon.
- `drivers`: tenant_id, name, phone, status.
- `delivery_assignments`: order_id, driver_id, assigned_at, delivered_at.
- `tracking_events`: order_id, status, lat, lng, created_at.

**Fidelización**

- `customers`: tenant_id, name, phone, email, birthdate.
- `loyalty_accounts`: customer_id, tenant_id, points, tier.
- `loyalty_tiers`: tenant_id, name, min_points, benefits.
- `points_ledger`: account_id, points, reason, order_id.
- `rewards`: tenant_id, name, cost_points, active.
- `reward_redemptions`: account_id, reward_id, redeemed_at.

**WhatsApp**

- `wa_accounts`: tenant_id, phone_number_id, waba_id, token_ref.
- `wa_templates`: tenant_id, name, language, category, status.
- `wa_messages`: tenant_id, order_id, template, status, provider_id.
- `wa_optins`: customer_id, phone, opted_in_at, source.
- `wa_webhook_events`: provider_event_id, payload, processed_at.

**Facturación electrónica**

- `einvoice_providers`: tenant_id, provider, credentials_ref, status.
- `einvoice_documents`: order_id, provider, number, cufe, status, pdf_url.

**Cambios a tablas existentes**

- Agregar `tenant_id` a: categories, products, addons, product_addons, orders, order_items, order_item_addons, order_status_history, expenses, expense_categories, daily_closings, inventory_items, inventory_movements, production_records, business_hours, special_closures, caja_movements, product_reviews, pqr_requests, audit_logs, product_consumptions, order_consumption_logs, order_consumption_overrides, addon_consumptions.
- `orders`: agregar `channel`, `table_id`, `pos_session_id`, `waiter_id`, `customer_id`.
- `products`: agregar `tenant_id`, `branch_id` opcional, `tax_rate`, `sku`.
- `categories` y `products`: únicos `(tenant_id, slug)`.
- `settings` → `tenant_settings` con PK compuesta.
- `profiles` → `memberships`; conservar `profiles` solo para datos globales del usuario.
- `roles` globales → roles por tenant o tabla de permisos.
- `order_number`: contador por tenant/sucursal.
- `audit_logs`: `tenant_id` obligatorio.
- `product-images`: ruta por tenant.

---

## 4. Migración de TETSU como tenant #1

### 4.1 Secuencia

1. **Backup completo** de Supabase y del storage.
2. Crear staging clonado.
3. Crear tenant TETSU, sucursal principal y membresías.
4. Agregar `tenant_id` nullable a todas las tablas.
5. Backfill de filas existentes con el ID de TETSU.
6. Validar conteos y relaciones.
7. Volver `tenant_id` obligatorio y crear índices.
8. Reescribir RLS con `is_tenant_member`.
9. Migrar settings globales a `tenant_settings`.
10. Migrar storage a `tenant_id/...`.
11. Adaptar código: contexto de tenant, consultas, caché y Realtime.
12. Ejecutar tests de aislamiento con dos tenants.
13. Cutover con feature flag.
14. Monitorear 72 horas.
15. Mantener el proyecto anterior como respaldo durante 30 días.

### 4.2 Rollback

- No borrar el esquema anterior hasta validar.
- Mantener backup y punto de restauración.
- El código debe poder volver a la versión single-tenant con una variable de entorno durante la ventana de cutover.
- Documentar el SQL de reversa de cada migración.

### 4.3 Criterios de aceptación

- TETSU sigue vendiendo sin cambios visibles.
- Dos tenants de prueba no se ven entre sí.
- Un usuario de TETSU no puede entrar a otro tenant.
- Los pedidos conservan numeración y datos.
- Las imágenes siguen cargando.
- Los reportes y cierres históricos cuadran.
- RLS 100% cubierta y probada.
- Build, lint, tests y E2E pasan.

---

## 5. POS y operación

### 5.1 Alcance del MVP

- Ruta `/pos` con grilla de productos, búsqueda y categorías.
- Carrito y notas por línea.
- Tipos de venta: mesa, para llevar, domicilio, mostrador.
- Cliente opcional y mesero.
- Descuentos, propinas y pagos divididos.
- Crear pedido con `origin = POS` y enviarlo a cocina.
- Turno de caja: apertura, movimientos, arqueo y cierre.
- Ticket de cliente y comanda de cocina.
- PIN por empleado y permisos.
- KDS en tiempo real por estación.

### 5.2 Flujo de venta

1. Cajero abre turno con base de caja.
2. Selecciona mesa o tipo de venta.
3. Agrega productos y adicionales.
4. Aplica descuento si tiene permiso.
5. Selecciona pago: efectivo, tarjeta, transferencia o mixto.
6. Registra propina.
7. Confirma y genera pedido + pago + comanda.
8. Cocina ve el pedido en KDS.
9. Cliente recibe ticket.
10. Cierre de turno: efectivo esperado vs contado.

### 5.3 Caja

- Integrar con `caja_movements` y `daily_closings` existentes.
- Evitar doble conteo de ventas.
- Apertura y cierre por turno, no solo por día.
- Arqueo ciego opcional.
- Reporte X (parcial) y Z (cierre).
- Diferencias con motivo y aprobación.

### 5.4 Impresión térmica

El navegador no imprime silenciosamente a una térmica de forma fiable. Opciones:

1. **Agente local + ESC/POS** (QZ Tray, Star webPRNT o agente propio): recomendado para USB/LAN.
2. **Web Bluetooth**: solo Chrome Android, con limitaciones.
3. **Print server en la nube**: útil para varias sedes, pero añade infraestructura.

Recomendación:

- Agente local para comandas y tickets.
- Plantillas por tenant y por estación.
- Reintentos e idempotencia en `print_jobs`.
- Prueba de impresión desde onboarding.
- Soporte para 58 mm y 80 mm.

### 5.5 KDS

- Columnas por estado o por estación.
- Botones: empezar, listo, recordar.
- Tiempo transcurrido y alertas.
- Filtro por categoría/estación.
- Sonido opcional.
- Realtime con reconexión.

### 5.6 Offline

- PWA + IndexedDB para catálogo y cola de pedidos.
- Idempotency key por venta.
- Sincronización al recuperar conexión.
- Resolución de conflictos y estado visible.
- Implementar solo si el mercado objetivo lo exige; añade 4–6 semanas.

### 5.7 Estimación

| Entregable | Tiempo |
|---|---:|
| POS core + caja + tickets | 4–6 semanas |
| KDS + impresión | 2–4 semanas |
| Mesas + pagos divididos + propinas | 2–3 semanas |
| Offline | 4–6 semanas |

---

## 6. Otros módulos

### 6.1 WhatsApp automático

Situación actual: enlaces `wa.me` manuales (`src/lib/whatsapp.ts`).

Evolución:

- Meta WhatsApp Cloud API.
- Verificación de negocio y número.
- Plantillas aprobadas.
- Opt-in del cliente.
- Ventana de 24 horas.
- Webhook con firma.
- Cola de salida y reintentos.
- Idempotencia por `provider_event_id`.
- Mensajes: pedido recibido, confirmado, en preparación, listo, en camino, entregado, solicitud de reseña.
- Costos por conversación; incluir paquete en el plan.

Arquitectura:

- Tabla outbox `wa_messages`.
- Cron/Edge Function cada minuto.
- Tokens por tenant cifrados.
- Panel de estado y errores.
- Modo manual en plan básico; automático en Pro/Premium.

### 6.2 Inventario y proveedores

- Proveedores, órdenes de compra y recepción.
- Lotes y costo promedio.
- Recetas por producto y consumo automático.
- Conteos físicos y ajustes.
- Alertas de stock bajo y vencimiento.
- Reporte de desperdicio.

### 6.3 Fidelización

- Clientes por tenant.
- Puntos por compra.
- Niveles Bronce, Plata, Oro y VIP.
- Recompensas y canjes.
- Cumpleaños y campañas.
- Reglas anti-abuso.
- Nunca compartir datos entre tenants.

### 6.4 Domicilios

- Zonas por barrio o polígono.
- Tarifa por zona y pedido mínimo.
- Asignación de domiciliarios.
- Estados y seguimiento.
- Liquidación de domiciliarios.
- Integración con mapas solo si aporta valor; evitar costo innecesario.

### 6.5 Facturación electrónica

- Integrar Siigo, Alegra o Factus.
- No construir la DIAN desde cero.
- Credenciales por tenant.
- Resolución, numeración y CUFE.
- Estado: pendiente, emitida, rechazada.
- PDF y XML descargables.
- Reintentos y soporte.

### 6.6 QR y landing

- QR por mesa, sucursal o campaña.
- Landing automática con branding del tenant.
- Menú digital indexable.
- UTM y analítica.
- Dominio propio opcional.

### 6.7 Reportes

- Ventas por día, canal, sucursal y medio de pago.
- Productos top y margen.
- Ticket promedio.
- Clientes frecuentes.
- Domicilios y tiempos.
- Export PDF/Excel.
- Reportes por WhatsApp para owners.

---

## 7. Planes y precios

> Precios en COP/mes, hipótesis a validar con 10–15 entrevistas. No incluyen IVA.

| Plan | Precio | Incluye |
|---|---:|---|
| **Menú Digital** | 59.000 | Menú, QR, pedidos, WhatsApp manual, 1 usuario, reportes básicos |
| **Pro** | 149.000 | POS, caja, cocina, inventario, domicilios, fidelización básica, 3 usuarios |
| **Premium** | 299.000 | Multi-sucursal, WhatsApp automático (1.000 mensajes), reportes avanzados, roles, API |
| **Enterprise** | desde 699.000 | White-label, base dedicada, SSO, SLA, facturación electrónica, integraciones |

### 7.1 Add-ons

- Sucursal extra: 39.000/mes.
- Usuario extra: 12.000/mes.
- Paquete WhatsApp: 1.000 mensajes.
- Alquiler de hardware: 80.000–150.000/mes.
- Implementación y migración: 250.000–500.000 pago único.
- Dominio propio y landing: 19.000/mes.
- Facturación electrónica: 49.000/mes.
- Soporte prioritario: 49.000/mes.

### 7.2 Ideas innovadoras

- **Plan Cocina Oculta:** solo menú, pedidos y domicilios; sin POS ni mesas.
- **Plan Cero:** menú gratis + comisión por pedido (1,5–2,5 %).
- **Plan Temporada:** prepago para ferias y eventos.
- **Plan Franquicia:** dashboard central, menús y precios por sucursal.
- **Hardware como servicio:** tablet + impresora + soporte en una cuota.
- **Migración gratis** desde Excel u otro POS.
- **Programa de partners:** agencias y diseñadores con comisión recurrente.
- **Pago anual con 2 meses gratis.**
- **Bundle de lanzamiento:** menú + QR + fotos + WhatsApp configurado.

### 7.3 Unit economics a validar

- Costo Supabase/Vercel por tenant.
- Costo WhatsApp por conversación.
- Costo de soporte por cuenta.
- Costo de adquisición (CAC).
- LTV esperado y churn.
- Margen bruto objetivo: >70 %.
- Punto de equilibrio por plan.

---

## 8. Roadmap

| Fase | Duración | Entregable |
|---|---:|---|
| **0. Estabilizar TETSU** | 2–3 semanas | Migraciones, CI, E2E, staging, Sentry, backups, repo privado, rotar claves |
| **1. Núcleo multi-tenant** | 4–6 semanas | Tenants, membresías, RLS, settings, storage, routing, migración TETSU, tests de aislamiento |
| **2. SaaS comercial** | 4–6 semanas | Plataforma admin, planes, suscripciones, trials, límites, onboarding, branding, dominios |
| **3. POS + KDS + impresión** | 6–10 semanas | POS, turnos, pagos divididos, mesas, cocina, agente de impresión |
| **4. Operación completa** | 6–10 semanas | Proveedores, compras, lotes, domicilios, fidelización, reportes avanzados |
| **5. Integraciones** | 6–10 semanas | WhatsApp API, facturación electrónica, QR/landing, API/webhooks, white-label |

**Supuestos:** 2–3 desarrolladores full-time, 1 diseñador/QA parcial y acceso del dueño para validar negocio.

**MVP vendible:** 4–6 meses.  
**Suite completa:** 12–18 meses.  
**Un solo desarrollador:** 12–24 meses.

---

## 9. Seguridad, legal y riesgos

### 9.1 Seguridad

- RLS con `tenant_id` en todas las tablas.
- Pruebas de aislamiento en CI con dos tenants.
- Service role fuera del cliente y de operaciones normales.
- Rate limit en Redis/Supabase.
- Turnstile en formularios públicos.
- CSP en modo bloqueo cuando esté limpia.
- Secretos en Vercel/Supabase, nunca en el repo.
- Rotación de claves.
- Auditoría de accesos de soporte.
- Backups cifrados y restauración probada.
- Logs con `tenant_id` y `request_id`.
- Dependencias auditadas y actualizadas.

### 9.2 Legal

- Términos de plataforma y DPA con cada tenant.
- Política de privacidad del SaaS y de cada menú.
- Consentimiento y retención de datos.
- WhatsApp: opt-in, plantillas y política de Meta.
- Facturación electrónica: responsabilidad del tenant y del proveedor certificado.
- Pagos: PCI DSS delegado al proveedor.
- Contratos de soporte y nivel de servicio.

### 9.3 Riesgos

| Riesgo | Mitigación |
|---|---|
| Fuga entre tenants | RLS + tests + revisión de seguridad |
| POS no imprime | Agente local + pruebas de hardware |
| WhatsApp bloquea el número | API oficial + opt-in + plantillas |
| Costos de infraestructura crecen | Límites por plan + métricas de uso |
| Churn por mala implementación | Onboarding guiado + soporte |
| Dependencia de un proveedor | Abstracción de billing, WhatsApp y e-invoice |
| Complejidad multi-sucursal | Modelo `branches` desde el inicio |
| Regresiones | CI + E2E + staging + feature flags |

---

## 10. Agentes de opencode

### 10.1 Roster

| Agente | Modo | Responsabilidad |
|---|---|---|
| `tetsu-saas-architect` | primary | Arquitectura, ADRs, modelo de datos, secuencia y revisión |
| `tenant-db` | subagent | Migraciones Supabase, `tenant_id`, RLS, backfill y tests SQL |
| `tenant-app` | subagent | Routing, contexto de tenant, theming, onboarding y admin |
| `pos-engineer` | subagent | POS, caja, mesas, KDS, impresión y offline |
| `billing-engineer` | subagent | Planes, suscripciones, pagos, webhooks y feature flags |
| `whatsapp-engineer` | subagent | Meta Cloud API, plantillas, colas y webhooks |
| `qa-isolation` | subagent | Playwright/Vitest, dos tenants, regresión y criterios |
| `security-reviewer` | subagent | RLS, auth, secretos, OWASP y aislamiento; solo reporta |
| `devops-release` | subagent | CI/CD, staging, backups, Sentry y despliegue |
| `product-strategist` | subagent | Precios, planes, entrevistas y unit economics; solo documentos |

### 10.2 Flujo

1. `tetsu-saas-architect` define fase, alcance y criterios.
2. `tenant-db` y `tenant-app` construyen el núcleo.
3. `pos-engineer`, `billing-engineer` y `whatsapp-engineer` ejecutan módulos.
4. `qa-isolation` valida con dos tenants.
5. `security-reviewer` audita antes de release.
6. `devops-release` despliega en staging y producción.
7. `product-strategist` valida precios y métricas.

### 10.3 Reglas para todos los agentes

- Leer este documento antes de trabajar.
- No hacer push sin autorización.
- No aplicar migraciones en producción sin backup y aprobación.
- No usar service role en cliente.
- No inventar datos del negocio.
- Mantener el español en UI y documentación.
- Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build`.
- Reportar archivos modificados, comandos ejecutados y riesgos.
- Respetar la identidad visual y las decisiones del dueño.

### 10.4 Ubicación de los agentes

`C:\Users\yeima\.config\opencode\agent\`

Archivos:

- `tetsu-saas-architect.md`
- `tenant-db.md`
- `tenant-app.md`
- `pos-engineer.md`
- `billing-engineer.md`
- `whatsapp-engineer.md`
- `qa-isolation.md`
- `security-reviewer.md`
- `devops-release.md`
- `product-strategist.md`

Después de crearlos, reiniciar opencode para que los cargue.

---

## 11. Backlog inicial

### E0 — Estabilización

- Aplicar migraciones pendientes.
- Crear CI con lint, tsc, tests y build.
- Añadir Playwright para pedido y reseña.
- Configurar Sentry.
- Documentar backups.
- Privatizar repo y rotar service role.
- Cerrar cambios locales.

### E1 — Núcleo multi-tenant

- Crear `tenants`, `memberships`, `tenant_settings`.
- Agregar `tenant_id` y backfill.
- Reescribir RLS.
- Resolver tenant por host.
- Migrar storage.
- Tests de aislamiento.
- Migrar TETSU como tenant #1.

### E2 — Branding y onboarding

- Configuración de marca por tenant.
- Logo, colores, fuentes y metadatos.
- Wizard de onboarding.
- Importación de menú CSV/Excel.
- Horarios, zonas y medios de pago.
- Prueba de impresión.

### E3 — Comercial

- Planes y feature flags.
- Trial de 14 días.
- Suscripción y cobro recurrente.
- Webhooks de pago.
- Límites por plan.
- Portal de facturación.
- Suspensión y reactivación.

### E4 — POS

- Turnos de caja.
- Grilla de productos.
- Pagos divididos.
- Mesas y meseros.
- Tickets y comandas.
- KDS.
- Impresión.
- Offline (fase 2).

### E5 — Operación

- Proveedores y compras.
- Lotes y vencimientos.
- Conteos.
- Domicilios y zonas.
- Fidelización.
- Reportes avanzados.

### E6 — Integraciones

- WhatsApp Cloud API.
- Facturación electrónica.
- QR/landing.
- API y webhooks.
- White-label.

---

## 12. Decisiones pendientes

1. ¿SaaS autoservicio o venta asistida con implementación?
2. ¿POS desde el día 1 o lanzar primero menú + pedidos + billing?
3. ¿WhatsApp manual en básico y API oficial en Pro?
4. ¿Facturación electrónica integrada o solo exportación al inicio?
5. ¿Multi-sucursal/franquicia desde el inicio?
6. ¿Hardware propio/alquiler o el cliente pone tablet/impresora?
7. ¿Mercado solo Colombia o expansión LatAm?
8. ¿Equipo, presupuesto y plazo disponibles?
9. ¿Nombre comercial del SaaS y dominio?
10. ¿Aislamiento dedicado para Enterprise desde el inicio?

---

## 13. Anexo: comandos y verificación

```powershell
# Calidad
npm run lint
npx tsc --noEmit
npm test
npm run build

# RLS
npm run check:rls
npm run verify:rls

# Migraciones (con Supabase CLI, cuando esté configurado)
supabase db push
supabase migration list
```

Checklist antes de cada release:

- [ ] Build, lint, tsc y tests pasan.
- [ ] RLS probada con dos tenants.
- [ ] No hay secretos en el diff.
- [ ] Migraciones con backup y rollback.
- [ ] Staging validado.
- [ ] Monitoreo y alertas activos.
- [ ] Documentación actualizada.
- [ ] Aprobación del dueño para producción.

---

## 14. Referencias internas

- `AUDITORIA.md` — auditoría single-tenant y lotes ejecutados.
- `docs/DESPLIEGUE.md` — despliegue actual.
- `docs/VARIABLES_DE_ENTORNO.md` — variables.
- `docs/PENDIENTES_LEGALES.md` — datos legales pendientes.
- `GUIA_DE_USO.md` — operación del negocio.
- `supabase/migrations/` — esquema y RLS.
- `src/config/site.ts` — datos de marca actuales.
- `src/proxy.ts` — control de acceso actual.
- `src/lib/whatsapp.ts` — WhatsApp manual actual.
- `src/lib/rate-limit.ts` — rate limit actual.

---

**Fin del documento.**
