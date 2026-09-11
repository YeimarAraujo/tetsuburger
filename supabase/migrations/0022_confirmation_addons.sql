-- Re-crea la confirmación de pedido incluyendo cantidad y destino de las
-- adiciones (quantity/target/components) para el board, WhatsApp y pantalla
-- de confirmación.

begin;

create or replace function public.get_order_confirmation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'order_number', o.order_number,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'payment_method', o.payment_method,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'customer_address', o.customer_address,
    'delivery_type', o.delivery_type,
    'notes', o.notes,
    'items', q.items
  )
  into v_result
  from public.orders o
  left join lateral (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'addons', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', a.addon_name,
            'price', a.addon_price,
            'quantity', coalesce(a.quantity, 1),
            'target', a.target,
            'components', a.components_qty
          ))
          from public.order_item_addons a
          where a.order_item_id = oi.id
        ), '[]'::jsonb)
      )
    ), '[]'::jsonb) as items
    from public.order_items oi
    where oi.order_id = o.id
  ) q on true
  where o.confirmation_token = p_token;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_order_confirmation(uuid) from public, anon, authenticated;
grant execute on function public.get_order_confirmation(uuid) to anon, authenticated;

commit;