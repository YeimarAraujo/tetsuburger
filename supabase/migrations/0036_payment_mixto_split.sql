-- ============================================================================
-- TETSUBURGER · 0036 — Medio de pago MIXTO (parte 2 de 2)
-- Requiere haber ejecutado 0035 antes (agrega el valor MIXTO al enum).
--
-- 1) orders.cash_amount / orders.transfer_amount: cuánto paga el cliente en
--    efectivo y cuánto por transferencia. Solo se usan cuando payment_method =
--    'MIXTO' (en los demás medios quedan en null). Constraint: ambos > 0 y su
--    suma es siempre igual al total del pedido.
-- 2) Trigger: si el total de un pedido MIXTO cambia (editar cobro, agregar
--    producto), se conserva la transferencia y el efectivo es el resto. Si la
--    transferencia ya cubre todo el total, el pedido pasa a TRANSFERENCIA.
-- 3) order_payment_split(): reparte la venta NETA de productos (sin domicilio)
--    entre efectivo y transferencia. En MIXTO la transferencia va primero
--    (hasta la venta neta) y el efectivo es el resto: el efectivo absorbe el
--    domicilio, que normalmente se le paga en mano al repartidor.
--    Debe coincidir con splitOrderPayment() de src/lib/payments.ts.
-- 4) update_order_payment(): cambia el medio de pago bajo bloqueo de fila, solo
--    antes de ENTREGADO (al entregar se registra la caja con el medio vigente).
-- 5) change_order_status(): al entregar un pedido MIXTO registra DOS
--    movimientos de caja (efectivo y transferencia). undo_order_status() ya
--    borra por ref_id, así que revierte ambos sin cambios.
-- Solo las funciones las ejecuta service_role (Server Actions).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

-- 1) Columnas y constraint ---------------------------------------------------
alter table public.orders
  add column if not exists cash_amount numeric(12,2),
  add column if not exists transfer_amount numeric(12,2);

comment on column public.orders.cash_amount is
  'Pago mixto: parte en efectivo. Null si payment_method <> MIXTO.';
comment on column public.orders.transfer_amount is
  'Pago mixto: parte por transferencia. Null si payment_method <> MIXTO.';

alter table public.orders drop constraint if exists orders_mixed_payment_check;
alter table public.orders
  add constraint orders_mixed_payment_check check (
    (
      payment_method = 'MIXTO'
      and coalesce(cash_amount, 0) > 0
      and coalesce(transfer_amount, 0) > 0
      and cash_amount + transfer_amount = total
    )
    or (
      payment_method <> 'MIXTO'
      and cash_amount is null
      and transfer_amount is null
    )
  );

-- 2) Mantener el desglose al cambiar el total --------------------------------
create or replace function public.sync_mixed_payment()
returns trigger
language plpgsql
as $$
begin
  if new.payment_method = 'MIXTO' and new.total is distinct from old.total then
    if coalesce(new.transfer_amount, 0) >= new.total then
      -- La transferencia ya cubre todo: deja de ser mixto.
      new.payment_method := 'TRANSFERENCIA';
      new.cash_amount := null;
      new.transfer_amount := null;
    else
      new.cash_amount := new.total - new.transfer_amount;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_sync_mixed_payment on public.orders;
create trigger trg_orders_sync_mixed_payment
  before update of total on public.orders
  for each row execute function public.sync_mixed_payment();

-- 3) Reparto de la venta neta entre efectivo y transferencia -----------------
create or replace function public.order_payment_split(
  p_method public.payment_method,
  p_net numeric,
  p_transfer numeric,
  out cash_part numeric,
  out transfer_part numeric
)
language sql
immutable
as $$
  select
    greatest(p_net, 0) - t.v,
    t.v
  from (
    select case
      when p_method = 'TRANSFERENCIA' then greatest(p_net, 0)
      when p_method = 'MIXTO' then least(coalesce(p_transfer, 0), greatest(p_net, 0))
      else 0
    end as v
  ) t;
$$;

-- 4) Cambiar el medio de pago (solo antes de ENTREGADO) ----------------------
create or replace function public.update_order_payment(
  p_order_id uuid,
  p_method public.payment_method,
  p_cash numeric default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_cash numeric;
  v_transfer numeric;
begin
  select id, status, total
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0001';
  end if;

  if v_order.status in ('ENTREGADO', 'CANCELADO') then
    raise exception 'El medio de pago no se puede cambiar en un pedido "%"',
      public.order_status_label(v_order.status)
      using errcode = 'P0001';
  end if;

  if p_method = 'MIXTO' then
    v_cash := round(coalesce(p_cash, 0), 2);
    if v_cash <= 0 or v_cash >= v_order.total then
      raise exception 'En un pago mixto el efectivo debe ser mayor que 0 y menor que el total del pedido'
        using errcode = 'P0001';
    end if;
    v_transfer := v_order.total - v_cash;
  else
    v_cash := null;
    v_transfer := null;
  end if;

  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  update public.orders
     set payment_method = p_method,
         cash_amount = v_cash,
         transfer_amount = v_transfer
   where id = p_order_id;
end;
$$;

-- 5) change_order_status con caja dividida en pagos mixtos -------------------
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
  v_cash numeric;
  v_transfer numeric;
  v_mixed boolean;
begin
  select id, status, delivery_type, order_number, subtotal, final_adjustment,
         payment_method, transfer_amount
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
  -- En un pago mixto se registran dos movimientos: efectivo y transferencia.
  if p_to = 'ENTREGADO' then
    v_net := v_order.subtotal - coalesce(v_order.final_adjustment, 0);
    if v_net > 0 and not exists (
      select 1 from public.caja_movements
       where ref_type = 'order' and ref_id = p_order_id::text
    ) then
      select s.cash_part, s.transfer_part
        into v_cash, v_transfer
        from public.order_payment_split(v_order.payment_method, v_net, v_order.transfer_amount) s;
      v_mixed := v_order.payment_method = 'MIXTO';

      if v_cash > 0 then
        insert into public.caja_movements
          (movement_date, tipo, metodo, amount, description, fuente, ref_type, ref_id, created_by)
        values (
          (now() at time zone 'America/Bogota')::date,
          'VENTA_EFECTIVO'::public.caja_tipo,
          'EFECTIVO',
          v_cash,
          format('Venta #%s %s', v_order.order_number,
                 case when v_mixed then 'mixto · efectivo' else 'en efectivo' end),
          format('Pedido #%s', v_order.order_number),
          'order',
          p_order_id::text,
          p_actor
        );
      end if;

      if v_transfer > 0 then
        insert into public.caja_movements
          (movement_date, tipo, metodo, amount, description, fuente, ref_type, ref_id, created_by)
        values (
          (now() at time zone 'America/Bogota')::date,
          'VENTA_TRANSFERENCIA'::public.caja_tipo,
          'TRANSFERENCIA',
          v_transfer,
          format('Venta #%s %s', v_order.order_number,
                 case when v_mixed then 'mixto · transferencia' else 'por transferencia' end),
          format('Pedido #%s', v_order.order_number),
          'order',
          p_order_id::text,
          p_actor
        );
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.update_order_payment(uuid, public.payment_method, numeric, uuid) from public, anon, authenticated;
grant execute on function public.update_order_payment(uuid, public.payment_method, numeric, uuid) to service_role;
revoke all on function public.change_order_status(uuid, public.order_status, uuid, text) from public, anon, authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, uuid, text) to service_role;

commit;
