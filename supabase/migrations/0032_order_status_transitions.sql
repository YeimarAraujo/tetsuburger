-- ============================================================================
-- TETSUBURGER · 0032 — Cambios de estado de pedidos: validados y con autor
-- 1) Autor: el servidor cambia pedidos con service_role, así que auth.uid()
--    es nulo y el historial quedaba sin "quién". Las funciones de abajo
--    guardan el usuario en app.actor_id (solo dura la transacción) y los
--    triggers de historial y auditoría lo usan cuando auth.uid() es nulo.
-- 2) change_order_status: valida la transición permitida, exige motivo al
--    cancelar y, al entregar, registra la venta en caja en la misma
--    transacción.
-- 3) undo_order_status: revierte el último cambio durante 2 minutos (y quita
--    la venta de caja si se deshace una entrega).
-- Solo las ejecuta service_role (Server Actions).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

-- 1) Autor de la operación ---------------------------------------------------
create or replace function public.current_actor()
returns uuid
language sql
stable
as $$
  select coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);
$$;

create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, public.current_actor());

    if new.status = 'CONFIRMADO' and new.confirmed_at is null then
      new.confirmed_at = now();
    elsif new.status = 'LISTO' and new.ready_at is null then
      new.ready_at = now();
    elsif new.status = 'ENTREGADO' and new.delivered_at is null then
      new.delivered_at = now();
    elsif new.status = 'CANCELADO' and new.cancelled_at is null then
      new.cancelled_at = now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.handle_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_rec text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  case tg_table_name
    when 'settings' then
      v_rec := coalesce(new.key, old.key, '');
    when 'business_hours' then
      v_rec := coalesce((new.day_of_week)::text, (old.day_of_week)::text, '');
    else
      v_rec := coalesce(new.id::text, old.id::text, '');
  end case;

  insert into public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  values (public.current_actor(), tg_op, tg_table_name, v_rec, v_old, v_new);

  return coalesce(new, old);
end;
$$;

-- 2) Transiciones permitidas -------------------------------------------------
create or replace function public.order_status_label(p_status public.order_status)
returns text
language sql
immutable
as $$
  select case p_status
    when 'PENDIENTE' then 'Pendiente'
    when 'CONFIRMADO' then 'Confirmado'
    when 'EN_PREPARACION' then 'En preparación'
    when 'LISTO' then 'Listo'
    when 'EN_CAMINO' then 'En camino'
    when 'ENTREGADO' then 'Entregado'
    when 'CANCELADO' then 'Cancelado'
  end;
$$;

-- Debe coincidir con canTransition() de src/lib/order-status.ts.
create or replace function public.order_transition_allowed(
  p_from public.order_status,
  p_to public.order_status,
  p_delivery public.delivery_type
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from in ('ENTREGADO', 'CANCELADO') then false
    when p_to = 'CANCELADO' then true
    when p_from = 'PENDIENTE' then p_to = 'CONFIRMADO'
    when p_from = 'CONFIRMADO' then p_to = 'EN_PREPARACION'
    when p_from = 'EN_PREPARACION' then p_to = 'LISTO'
    when p_from = 'LISTO' then
      (p_delivery = 'DOMICILIO' and p_to = 'EN_CAMINO')
      or (p_delivery <> 'DOMICILIO' and p_to = 'ENTREGADO')
    when p_from = 'EN_CAMINO' then p_to = 'ENTREGADO'
    else false
  end;
$$;

-- 3) Cambio de estado --------------------------------------------------------
create or replace function public.change_order_status(
  p_order_id uuid,
  p_to public.order_status,
  p_actor uuid default null,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_net numeric;
  v_transfer boolean;
begin
  select id, status, delivery_type, order_number, subtotal, final_adjustment, payment_method
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0001';
  end if;

  if v_order.status = p_to then
    return;
  end if;

  if not public.order_transition_allowed(v_order.status, p_to, v_order.delivery_type) then
    raise exception 'El pedido está en "%" y no puede pasar a "%"',
      public.order_status_label(v_order.status), public.order_status_label(p_to)
      using errcode = 'P0001';
  end if;

  if p_to = 'CANCELADO' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indica el motivo de la cancelación' using errcode = 'P0001';
  end if;

  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  update public.orders
     set status = p_to,
         cancellation_reason = case when p_to = 'CANCELADO' then trim(p_reason) else cancellation_reason end
   where id = p_order_id;

  -- Al entregar, la venta neta de productos entra a la caja (sin domicilios).
  if p_to = 'ENTREGADO' then
    v_net := v_order.subtotal - coalesce(v_order.final_adjustment, 0);
    if v_net > 0 and not exists (
      select 1 from public.caja_movements
       where ref_type = 'order' and ref_id = p_order_id::text
    ) then
      v_transfer := v_order.payment_method = 'TRANSFERENCIA';
      insert into public.caja_movements
        (movement_date, tipo, metodo, amount, description, fuente, ref_type, ref_id, created_by)
      values (
        (now() at time zone 'America/Bogota')::date,
        (case when v_transfer then 'VENTA_TRANSFERENCIA' else 'VENTA_EFECTIVO' end)::public.caja_tipo,
        case when v_transfer then 'TRANSFERENCIA' else 'EFECTIVO' end,
        v_net,
        format('Venta #%s %s', v_order.order_number,
               case when v_transfer then 'por transferencia' else 'en efectivo' end),
        format('Pedido #%s', v_order.order_number),
        'order',
        p_order_id::text,
        p_actor
      );
    end if;
  end if;
end;
$$;

-- 4) Deshacer el último cambio (2 minutos) ----------------------------------
create or replace function public.undo_order_status(
  p_order_id uuid,
  p_actor uuid default null
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
  v_last record;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0001';
  end if;

  select from_status, to_status, created_at
    into v_last
    from public.order_status_history
   where order_id = p_order_id
   order by created_at desc
   limit 1;

  if v_last is null or v_last.from_status is null or v_last.to_status <> v_status then
    raise exception 'Este pedido no tiene un cambio reciente para deshacer' using errcode = 'P0001';
  end if;

  if v_last.created_at < now() - interval '2 minutes' then
    raise exception 'Solo se puede deshacer durante los 2 minutos siguientes al cambio'
      using errcode = 'P0001';
  end if;

  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  update public.orders
     set status = v_last.from_status,
         confirmed_at = case when v_status = 'CONFIRMADO' then null else confirmed_at end,
         ready_at = case when v_status = 'LISTO' then null else ready_at end,
         delivered_at = case when v_status = 'ENTREGADO' then null else delivered_at end,
         cancelled_at = case when v_status = 'CANCELADO' then null else cancelled_at end,
         cancellation_reason = case when v_status = 'CANCELADO' then '' else cancellation_reason end
   where id = p_order_id;

  if v_status = 'ENTREGADO' then
    delete from public.caja_movements where ref_type = 'order' and ref_id = p_order_id::text;
  end if;

  return v_last.from_status;
end;
$$;

revoke all on function public.change_order_status(uuid, public.order_status, uuid, text) from public, anon, authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, uuid, text) to service_role;
revoke all on function public.undo_order_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.undo_order_status(uuid, uuid) to service_role;

commit;
