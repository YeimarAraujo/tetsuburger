# GUÍA DE USO — TETSUBURGER

## ⚠️ PASOS OBLIGATORIOS ANTES DE EMPEZAR

Ejecuta estos dos scripts en el **SQL Editor** de Supabase Dashboard:

**Migration 0002** — Medio de pago:
```sql
create type public.payment_method as enum ('EFECTIVO', 'TRANSFERENCIA');
alter table public.orders add column payment_method public.payment_method not null default 'EFECTIVO';
```

**Migration 0003** — Costos en producción:
```sql
ALTER TABLE public.production_records ADD COLUMN unit_cost numeric(12,2) not null default 0;
ALTER TABLE public.production_records ADD COLUMN total_cost numeric(12,2) not null default 0;
```

---

## CATÁLOGO PÚBLICO (`tudominio.com`)

La página principal es el menú público. Los clientes:

1. **Exploran** productos organizados por categoría (Hamburguesas, Perros, Bebidas…)
2. **Agregan al carrito** con cantidades y adicionales (tocineta, queso, etc.)
3. **Van a checkout**: llenan nombre, dirección (si es domicilio), teléfono
4. **Eligen medio de pago**: Efectivo o Transferencia
5. **Confirman** → se redirigen a WhatsApp con el pedido formateado
6. Si la tienda está **cerrada**, aparece un modal con countdown de cuándo abre

**Flujo del cliente:**
```
Catálogo → Carrito → Checkout → WhatsApp → Llega el pedido al admin
```

---

## PANEL DE ADMINISTRACIÓN (`/admin`)

### Login
- URL: `/admin/login`
- Credenciales: las que configuraste en Supabase Auth
- Solo perfiles con role = ADMIN pueden acceder

---

### 📊 Dashboard (`/admin`)
**Qué ve:** Resumen del día actual en tiempo real.

| Sección | Qué muestra |
|---|---|
| Estado | Abierto/Cerrado con mensaje |
| KPIs | Pedidos hoy, ventas, gastos, utilidad estimada |
| Por estado | Cuántos pendientes, confirmados, en preparación… |
| Por pago | Cuántos en efectivo vs transferencia |
| Stock bajo | Alerta de insumos por debajo del mínimo |
| Pedidos recientes | Últimos 8 pedidos del día |

---

### 📋 Pedidos (`/admin/pedidos`)
**Qué hace:** Board en tiempo real de todos los pedidos.

**Columnas (flujo):**
```
PENDIENTE → CONFIRMADO → EN PREPARACIÓN → LISTO → EN CAMINO → ENTREGADO
```

**Qué puedes hacer:**
- **Avanzar estado**: click en "→ Siguiente estado"
- **Cancelar**: con motivo obligatorio
- **Filtrar**: por día (Hoy / Ayer / 7 días / Personalizado)
- **Sonido**: suena cuando llega un pedido nuevo

**Cada tarjeta muestra:**
- Número de pedido (#)
- Cliente + teléfono
- Tipo: Domicilio / Recoge / Local
- **Medio de pago**: Efectivo 💵 o Transferencia 🏦
- Tiempo transcurrido
- Origen: WEB (catálogo) o MANUAL (tomado en el local)

**Pedido nuevo:** Botón arriba → se abre el formulario para tomar pedidos por teléfono/presencial. Nace como CONFIRMADO.

---

### 🍔 Productos (`/admin/productos`)
**Qué hace:** CRUD completo de productos del menú.

**Para cada producto:**
- Nombre, slug (URL), descripción, precio en COP
- Imagen (sube a Storage de Supabase)
- Categoría a la que pertenece
- Switches: **Activo** (visible), **Disponible** (se puede pedir), **Destacado** (aparece arriba)
- **Adicionales asociados**: qué extras puede llevar este producto

**Filtros:** buscar por nombre, categoría, estado.

---

### ➕ Adicionales (`/admin/adicionales`)
**Qué hace:** Gestiona extras que se agregan a los productos (tocineta, queso extra, aguacate…).

- Nombre + precio
- Activar/desactivar
- Se asocian desde la ficha de cada producto

---

### 🏷️ Categorías (`/admin/categorias`)
**Qué hace:** Organiza los productos en grupos.

- Nombre + slug + descripción + imagen
- Reordenar con flechas arriba/abajo
- Activar/desactivar (las inactivas desaparecen del catálogo)

---

### 🕐 Horarios (`/admin/horarios`)
**Qué hace:** Define los días y horas de atención.

- 7 filas (Lunes a Domingo)
- Para cada día: hora apertura + hora cierre + activo/inactivo
- Soporta **cruce de medianoche** (ej: 18:00 → 02:00)
- El sistema calcula automáticamente si está abierto o cerrado
- Controla el **modal de cierre** en el catálogo público

---

### ⚙️ Configuración (`/admin/configuracion`)
**Qué hace:** Ajustes generales del negocio.

| Campo | Qué controla |
|---|---|
| Número WhatsApp | Número al que llegan los pedidos |
| Costo domicilio | Fee fijo que se suma al total |
| Cierre temporal | Toggle para cerrar la tienda manualmente |
| Mensaje de cierre | Texto que ve el cliente cuando está cerrado |
| Banner text | Texto del hero si no hay imagen |
| Dirección | Se muestra en el footer |
| Redes sociales | Links de Instagram, TikTok, Facebook |

---

### 💸 Gastos (`/admin/gastos`)
**Qué hace:** Registra todos los egresos del negocio.

**Para cada gasto:**
- Fecha, categoría (Arrienda, Servicios, Nómina, Mantenimiento, etc.)
- Concepto descriptivo, valor en COP
- Descripción opcional

**Filtros:** rango de fechas + categoría. Atajos: Hoy, Ayer, 7 días.

**KPIs:** Total del período, número de registros, promedio.

**Exportar CSV:** Descarga un archivo con los filtros actuales (formato Excel español).

> Los gastos **no se eliminan** — se corrigen editando. Queda auditoría automática.

---

### 📦 Inventario (`/admin/inventario`)
**Qué hace:** Control de insumos y materia prima.

**Insumos registrados:**
- Nombre, unidad (kg, litro, unidad…), stock actual, stock mínimo
- Alerta visual cuando el stock está por debajo del mínimo

**Movimientos:**
- **Entrada**: compras, recepción de mercancía
- **Salida**: uso en producción, desperdicio
- **Ajuste**: conteo físico (reemplaza el stock actual)

Cada movimiento se registra con fecha, cantidad, tipo y referencia.

---

### 👨‍🍳 Compras del día (`/admin/produccion`)
**Qué hace:** Registra la materia prima que **compraste** cada día para cocinar.

**Para cada compra:**
- Fecha
- Insumo (seleccionado del inventario ya registrado)
- Cantidad comprada
- Costo unitario (lo que pagaste hoy por unidad — cambia cada día)
- Costo total (calculado automáticamente)
- Notas (dónde compraste, etc.)

**Flujo típico:**
1. Registras insumos en Inventario (carne, panes, lechuga…)
2. Cada día abres Compras del día y registras qué compraste
3. Pones el costo unitario del día (ej: $18.000/kg de carne)
4. El sistema calcula el costo total de compras del día

> Esto alimenta las Finanzas con el costo real de materia prima.

---

### 💰 Finanzas (`/admin/finanzas`)
**Qué hace:** Vista consolidada de la salud financiera.

**KPIs:**
- Ingresos por ventas
- Gastos operativos
- Compras de materia prima
- Utilidad neta + margen de ganancia

**Desgloses:**
- Por método de pago (efectivo vs transferencia)
- Gastos por categoría
- Ingresos por origen (WEB vs MANUAL)
- Utilidad día por día (basado en cierres)

**Fórmula:** `Ventas − Gastos operativos − Compras materia prima = Utilidad neta`

---

### 📊 Reportes (`/admin/reportes`)
**Qué hace:** Resumen detallado por período con exportación CSV.

**Filtros:** rango de fechas + categoría de gasto. Atajos: Hoy, 7 días, 30 días, Este mes.

**Muestra:** pedidos del período, KPIs, desglose por pago, tabla detallada.

**Exportar CSV:** descarga ventas + gastos + resumen en un solo archivo.

---

### 🔒 Cierres Diarios (`/admin/cierres`)
**Qué hace:** Congela los totales de un día para que queden como registro histórico.

**Para cerrar un día:**
1. Click en "Cerrar día"
2. Seleccionas la fecha
3. El sistema calcula automáticamente: pedidos, ventas, gastos, utilidad
4. Confirmas → el registro queda **inmutable** (no se puede editar ni borrar)

**Historial:** Lista de todos los cierres con sus totales.

> Los cierres son permanentes por diseño — protegidos con trigger en la base de datos.

---

### 🛡️ Auditoría (`/admin/auditoria`)
**Qué hace:** Registro de todas las modificaciones al sistema.

- Cada INSERT, UPDATE o DELETE queda registrado automáticamente
- Muestra: qué tabla, qué acción, qué cambió, cuándo
- Filtros: por tabla y por tipo de acción
- **Solo lectura** — no se puede modificar

---

## FLUJO DIARIO TÍPICO

```
MAÑANA:
1. Abrir horarios si es necesario
2. Revisar Dashboard → ver pedidos pendientes de anoche
3. Tomar pedidos en el board

DURANTE EL DÍA:
4. Avanzar estados de pedidos (PENDIENTE → CONFIRMADO → … → ENTREGADO)
5. Registrar gastos que vayan surgiendo

CIERRE:
6. Registrar en Compras del día la materia prima que compraste
7. Ir a Cierres y cerrar el día
8. Revisar Finanzas para ver la utilidad del día
9. Exportar Reportes si necesitas enviar datos a tu contador
```

---

## CREDENCIALES

| Item | Valor |
|---|---|
| Admin email | `tetsuburger@gmail.com` |
| Supabase URL | `https://mbkiybbfdpcjqqioxkkm.supabase.co` |
| WhatsApp configured | `573044243650` |
| Zona horaria | America/Bogota |
| Moneda | COP (Peso colombiano) |
