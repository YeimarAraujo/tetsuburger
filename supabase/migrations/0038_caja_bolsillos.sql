-- ============================================================================
-- TETSUBURGER · 0038 — Caja con dos bases: COMPRAS y GANANCIA
-- Cada movimiento de caja pertenece a una base (columna "bolsillo") y, dentro
-- de ella, a un medio (efectivo o transferencia).
--
--   * Al entregar un pedido: el COSTO de lo vendido entra a COMPRAS y el MARGEN
--     (venta neta − costo) entra a GANANCIA. En pago mixto el reparto entre
--     efectivo y transferencia se mantiene en proporción.
--   * Las compras y gastos "sale de caja" eligen de qué base descuentan.
--   * Nuevo tipo TRASLADO: mover plata de una base a otra (dos filas ligadas).
--   * El saldo de cada base es la suma de sus movimientos; la Base de Compras
--     arranca con un traslado inicial (ver 0039, ejecutar aparte después).
--
-- El historial existente queda en GANANCIA (valor por defecto de la columna).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter type public.caja_tipo add value if not exists 'TRASLADO';

alter table public.caja_movements
  add column if not exists bolsillo text not null default 'GANANCIA'
  check (bolsillo in ('COMPRAS', 'GANANCIA'));

create index if not exists idx_caja_movements_bolsillo
  on public.caja_movements (bolsillo, movement_date);

-- Costo de lo vendido en un pedido (mismo cálculo que sales_analytics, 0033):
-- costo guardado en cada línea + adicionales (× componentes si aplica a cada uno).
create or replace function public.order_cogs(p_order_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    oi.unit_cost * oi.quantity
    + coalesce((
        select sum(a.unit_cost * a.quantity
                   * case when a.target = 'EACH' then coalesce(a.components_qty, 1) else 1 end)
          from public.order_item_addons a
         where a.order_item_id = oi.id
      ), 0) * oi.quantity
  ), 0)
  from public.order_items oi
  where oi.order_id = p_order_id;
$$;

revoke all on function public.order_cogs(uuid) from public, anon, authenticated;
grant execute on function public.order_cogs(uuid) to service_role;

-- change_order_status: la venta entregada se reparte entre COMPRAS y GANANCIA.
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
  v_cogs numeric;
  v_compras numeric;
  v_compras_cash numeric;
  v_compras_transfer numeric;
  v_label_cash text;
  v_label_transfer text;
  v_suffix_compras text;
  v_suffix_ganancia text;
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

  -- Al entregar, la venta neta de productos entra a la caja (sin domicilios):
  -- el costo a COMPRAS y el margen a GANANCIA, cada uno en efectivo y/o
  -- transferencia según cómo pagó el cliente.
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

      -- El costo nunca supera la venta neta (el margen no puede ser negativo).
      v_cogs := public.order_cogs(p_order_id);
      v_compras := round(least(greatest(v_cogs, 0), v_net), 2);
      v_compras_cash := least(v_cash, round(v_compras * v_cash / v_net, 2));
      v_compras_transfer := least(v_transfer, v_compras - v_compras_cash);

      v_label_cash := case when v_mixed then 'mixto · efectivo' else 'en efectivo' end;
      v_label_transfer := case when v_mixed then 'mixto · transferencia' else 'por transferencia' end;
      v_suffix_compras := ' · costo → Compras';
      v_suffix_ganancia := case
        when v_cogs <= 0 then ' · margen → Ganancia (sin costo cargado)'
        else ' · margen → Ganancia'
      end;

      insert into public.caja_movements
        (movement_date, tipo, metodo, bolsillo, amount, description, fuente, ref_type, ref_id, created_by)
      select
        (now() at time zone 'America/Bogota')::date,
        (case when m.metodo = 'TRANSFERENCIA' then 'VENTA_TRANSFERENCIA' else 'VENTA_EFECTIVO' end)::public.caja_tipo,
        m.metodo,
        m.bolsillo,
        m.amount,
        format('Venta #%s %s%s', v_order.order_number, m.label,
               case when m.bolsillo = 'COMPRAS' then v_suffix_compras else v_suffix_ganancia end),
        format('Pedido #%s', v_order.order_number),
        'order',
        p_order_id::text,
        p_actor
      from (
        values
          ('EFECTIVO',      'COMPRAS',  v_compras_cash,                v_label_cash),
          ('EFECTIVO',      'GANANCIA', v_cash - v_compras_cash,       v_label_cash),
          ('TRANSFERENCIA', 'COMPRAS',  v_compras_transfer,            v_label_transfer),
          ('TRANSFERENCIA', 'GANANCIA', v_transfer - v_compras_transfer, v_label_transfer)
      ) as m(metodo, bolsillo, amount, label)
      where m.amount > 0;
    end if;
  end if;
end;
$$;

revoke all on function public.change_order_status(uuid, public.order_status, uuid, text) from public, anon, authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, uuid, text) to service_role;

-- undo_order_status (0032) no cambia: borra todas las filas de caja del pedido
-- por ref_type/ref_id, incluidas las nuevas de COMPRAS y GANANCIA.
