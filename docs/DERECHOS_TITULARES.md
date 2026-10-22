# Procedimiento interno para derechos del titular

> Uso interno. No publicar en la web. La decisión final sobre retención y
> anonimización es del titular del negocio.

## 1. Canales de entrada

- Correo: `site.privacyEmail` (ver `src/config/site.ts`).
- WhatsApp: `site.phone`.
- Formulario: `/pqr` → tabla `pqr_requests` → `/admin/pqr`.

Toda solicitud debe quedar registrada con fecha, canal, tipo y estado en
`pqr_requests` (o en la bandeja que la reemplace).

## 2. Verificación de identidad

Antes de entregar o modificar datos, confirmar que quien solicita es el titular:

1. Pedir nombre completo y un dato que solo el titular conozca (número de
   pedido o teléfono usado en la compra).
2. Si hay duda, solicitar documento de identidad por un canal privado.
3. No enviar datos por correo a direcciones no verificadas.

## 3. Plazos

- **Consultas:** 10 días hábiles (prórroga de 5).
- **Reclamos:** 15 días hábiles (prórroga de 8).
- Si la solicitud es incompleta, se cuenta desde que el titular la complete.

## 4. Cómo localizar los datos

| Fuente | Cómo buscar |
|---|---|
| Pedidos | `orders.customer_phone` o `orders.customer_name` |
| Reseñas | `product_reviews.customer_name` o `order_id` |
| Sesiones | `auth.users` por correo (solo staff) |
| PQR | `pqr_requests.email` |
| Logs | `audit_logs` por fecha/actor |

## 5. Acciones típicas

### Acceso / portabilidad
Exportar los pedidos asociados al teléfono o correo y entregarlos en PDF o
texto plano por un canal verificado.

### Rectificación
Actualizar nombre, teléfono o dirección en `orders` (solo si el pedido aún no
fue entregado) y en `pqr_requests`.

### Supresión / anonimización
Cuando no exista obligación legal de conservar el dato, anonimizar en lugar de
borrar para no romper reportes históricos:

```sql
update public.orders
set customer_name = 'Cliente anonimizado',
    customer_phone = '',
    customer_address = '',
    notes = ''
where id = '<ORDER_ID>';
```

Para reseñas:

```sql
update public.product_reviews
set customer_name = 'Cliente anonimizado',
    comment = ''
where id = '<REVIEW_ID>';
```

Para solicitudes PQR:

```sql
delete from public.pqr_requests where id = '<PQR_ID>';
```

### Revocatoria de autorización
Registrar la fecha y el alcance de la revocatoria. Dejar de usar los datos para
marketing o analítica; conservar solo lo necesario para obligaciones legales.

## 6. Propuesta de retención (decisión pendiente)

| Dato | Propuesta | Decisión |
|---|---|---|
| Pedidos y detalle | Mientras exista relación comercial + término contable/fiscal que defina el contador | Pendiente |
| Reseñas publicadas | Hasta que el titular solicite supresión | Pendiente |
| PQR | 2 años desde el cierre, luego eliminar | Pendiente |
| Logs de auditoría | 1 año | Pendiente |
| Analítica | Agregada; no se conserva por persona | — |

## 7. Registro de solicitudes

Mantener una fila por solicitud con: fecha de recibo, fecha de respuesta,
acción tomada y responsable. El estado se actualiza en `/admin/pqr`.
