-- ============================================================================
-- TETSUBURGER · 0017 — Configuración y preferencias al backend
-- 1) Costos del negocio de Rentabilidad se guardan en settings (ya no en
--    localStorage). RLS: staff escribe, staff lee claves no públicas.
-- 2) Preferencia de sonido del board por usuario de staff (profiles.board_muted).
-- 3) Confirmación de pedido por token seguro (orders.confirmation_token + RPC
--    SECURITY DEFINER) para eliminar sessionStorage del checkout.
-- 4) Backfill: costos de insumos desde compras históricas vinculadas (solo los
--    que siguen en 0; las compras recientes no se registraron con insumo).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

-- 1) Costos del negocio de rentabilidad (mismos defaults que usaba localStorage)
insert into public.settings (key, value, is_public, updated_at)
values (
  'rentabilidad_business_costs',
  '{"unidadesMes":300,"utilidadPct":15,"comisionPct":0,"comisionFija":0,"nomina":0,"arriendo":0,"servicios":0,"otrosFijos":0}'::jsonb,
  false,
  now()
)
on conflict (key) do nothing;

-- 2) Preferencia de sonido del board por usuario de staff
alter table public.profiles
  add column if not exists board_muted boolean not null default false;

-- El staff solo puede actualizar su propia fila (hoy solo existe lectura).
drop policy if exists "staff_update_own_profile" on public.profiles;
create policy "staff_update_own_profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- 3) Confirmación de pedido por token (sin exponer la tabla orders al público)
alter table public.orders
  add column if not exists confirmation_token uuid not null default gen_random_uuid();

create index if not exists idx_orders_confirmation_token on public.orders (confirmation_token);

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
          select jsonb_agg(jsonb_build_object('name', a.addon_name, 'price', a.addon_price))
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

-- 4) Backfill: costo unitario de insumos desde las compras históricas vinculadas.
--    Carne: la compra fue por kg (27000/kg) y el insumo usa gramos -> 27/gramo.
--    El resto: la unidad de compra coincide con la del insumo.
update public.inventory_items set cost = 27    where id = 'bb808bc5-5c2d-4839-840d-0241f39053d4' and cost = 0; -- Carne Hamburguesa
update public.inventory_items set cost = 917   where id = '5bd35d4a-adbf-4952-86a6-87c9e7761c63' and cost = 0; -- Gaseosa postobon 250ml
update public.inventory_items set cost = 720   where id = '89b44a16-997f-4800-901a-ef263b020e0a' and cost = 0; -- Pan Perro
update public.inventory_items set cost = 300   where id = 'fc04662a-dea8-438b-9993-62e4bf8baa19' and cost = 0; -- Porta Hamburguesa
update public.inventory_items set cost = 950   where id = 'c8cfe008-3f15-4a2a-a181-523cb127a095' and cost = 0; -- Pan hamburguesa
update public.inventory_items set cost = 500   where id = 'ade5ef00-56a3-4bc5-98d6-c4d9bba9ef51' and cost = 0; -- Queso cheddar
update public.inventory_items set cost = 3500  where id = '26dc2ea3-ac29-4c67-8f5e-31e9e44f65b0' and cost = 0; -- Salchicha ranchera
update public.inventory_items set cost = 1200  where id = 'fc6e2887-1f86-4f89-b60a-59202bfc537e' and cost = 0; -- Coca cola zero 250ml
update public.inventory_items set cost = 5.15  where id = '58108123-4d84-4222-990f-154cb8b8eb40' and cost = 0; -- Tomate

commit;