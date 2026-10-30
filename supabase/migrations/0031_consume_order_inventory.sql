-- ============================================================================
-- TETSUBURGER · 0031 — Descuento de inventario por pedido en una transacción
-- Antes el servidor leía el stock, calculaba el nuevo valor y lo escribía en
-- pasos separados: dos pedidos preparados a la vez podían perder un descuento
-- y un doble clic podía descontar dos veces. Esta función:
--   1. bloquea la fila del pedido (serializa llamadas para el mismo pedido),
--   2. no hace nada si el pedido ya tiene logs de consumo (idempotente),
--   3. descuenta con current_stock = current_stock - x (sin carrera),
--   4. registra movimiento SALIDA y log inmutable, todo o nada.
-- Solo la ejecuta service_role (Server Actions).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

create or replace function public.consume_order_inventory(
  p_order_id uuid,
  p_reference text,
  p_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if exists (select 1 from public.order_consumption_logs where order_id = p_order_id) then
    return false;
  end if;

  for v_item in
    select x.item_id, x.quantity, coalesce(x.refs, '') as refs
    from jsonb_to_recordset(p_items) as x(item_id uuid, quantity numeric, refs text)
    where x.quantity > 0
  loop
    update public.inventory_items
       set current_stock = greatest(0, current_stock - v_item.quantity)
     where id = v_item.item_id;

    insert into public.inventory_movements (inventory_item_id, movement_type, quantity, reference)
    values (v_item.item_id, 'SALIDA', v_item.quantity, p_reference);

    insert into public.order_consumption_logs (order_id, inventory_item_id, quantity, product_reference)
    values (p_order_id, v_item.item_id, v_item.quantity, v_item.refs);
  end loop;

  return true;
end;
$$;

revoke all on function public.consume_order_inventory(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.consume_order_inventory(uuid, text, jsonb) to service_role;

commit;
