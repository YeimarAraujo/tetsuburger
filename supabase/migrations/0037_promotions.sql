-- ============================================================================
-- TETSUBURGER · 0037 — Promociones: regalos por monto y domicilio gratis
-- Reglas configurables desde el panel (Productos > Promociones):
--   · promotion_rules: monto mínimo (subtotal de productos + adicionales, sin
--     domicilio) y beneficios. Las reglas se acumulan: el domicilio gratis lo da
--     cualquier regla alcanzada; el regalo se sortea entre los de la regla
--     alcanzada de mayor monto que tenga algún regalo con stock.
--   · promotion_rule_gifts: productos que pueden salir de regalo en una regla.
--   · order_items.is_gift: el regalo se guarda como línea del pedido a $0, así
--     descuenta inventario, aparece en cocina y su costo queda en los reportes.
--   · orders.free_delivery: marca que el domicilio fue gratis por promoción
--     (la confirmación y el WhatsApp lo muestran como "GRATIS").
--   · get_public_promotions(): solo expone montos y si hay regalo, NUNCA cuál,
--     para que el regalo siga siendo sorpresa.
-- Las reglas iniciales se crean DESACTIVADAS: actívalas en el panel después de
-- agregar los productos de regalo.
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

-- 1) Reglas ------------------------------------------------------------------
create table if not exists public.promotion_rules (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default '',
  min_total     numeric(12,2) not null check (min_total > 0),
  free_delivery boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.promotion_rule_gifts (
  id         uuid primary key default gen_random_uuid(),
  rule_id    uuid not null references public.promotion_rules (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (rule_id, product_id)
);
create index if not exists idx_promotion_rule_gifts_rule
  on public.promotion_rule_gifts (rule_id);

drop trigger if exists trg_promotion_rules_updated on public.promotion_rules;
create trigger trg_promotion_rules_updated before update on public.promotion_rules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_promotion_rules on public.promotion_rules;
create trigger trg_audit_promotion_rules after insert or update or delete on public.promotion_rules
  for each row execute function public.handle_audit();

drop trigger if exists trg_audit_promotion_rule_gifts on public.promotion_rule_gifts;
create trigger trg_audit_promotion_rule_gifts after insert or update or delete on public.promotion_rule_gifts
  for each row execute function public.handle_audit();

-- Solo staff lee/escribe las tablas; el público usa get_public_promotions().
alter table public.promotion_rules      enable row level security;
alter table public.promotion_rule_gifts enable row level security;

drop policy if exists "staff_promotion_rules" on public.promotion_rules;
create policy "staff_promotion_rules" on public.promotion_rules
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff_promotion_rule_gifts" on public.promotion_rule_gifts;
create policy "staff_promotion_rule_gifts" on public.promotion_rule_gifts
  for all using (public.is_staff()) with check (public.is_staff());

-- 2) Marcas en el pedido -------------------------------------------------------
alter table public.order_items
  add column if not exists is_gift boolean not null default false;

alter table public.orders
  add column if not exists free_delivery boolean not null default false;

comment on column public.order_items.is_gift is
  'Línea regalada por una promoción (precio 0). No cuenta como unidad vendida en reportes.';
comment on column public.orders.free_delivery is
  'El domicilio fue gratis por una promoción (delivery_fee = 0).';

-- 3) Lo que puede ver el público (sin revelar el regalo) -----------------------
create or replace function public.get_public_promotions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'min_total', t.min_total,
             'free_delivery', t.free_delivery,
             'has_gift', t.has_gift
           ) order by t.min_total
         ), '[]'::jsonb)
    from (
      select r.min_total,
             r.free_delivery,
             exists (
               select 1
                 from public.promotion_rule_gifts g
                 join public.products p on p.id = g.product_id
                where g.rule_id = r.id and g.is_active and p.is_active
             ) as has_gift
        from public.promotion_rules r
       where r.is_active
    ) t
   where t.free_delivery or t.has_gift;
$$;

revoke all on function public.get_public_promotions() from public;
grant execute on function public.get_public_promotions() to anon, authenticated, service_role;

-- 4) Confirmación del pedido: incluye regalo y domicilio gratis -----------------
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
    'id', o.id,
    'order_number', o.order_number,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'free_delivery', o.free_delivery,
    'total', o.total,
    'final_adjustment', o.final_adjustment,
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
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'is_gift', oi.is_gift,
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

-- 5) Reportes: el regalo no cuenta como venta pero sí su costo ------------------
-- Cada regalo aparece como "Regalo: <producto>" con 0 unidades y 0 ingresos; su
-- costo real sigue sumando al costo del día, así la utilidad no se infla.
create or replace function public.sales_report_lines(p_start timestamptz, p_end timestamptz)
returns table (
  order_id uuid,
  local_ts timestamp,
  product_key text,
  product_id uuid,
  product_name text,
  category_name text,
  quantity integer,
  revenue numeric,
  cost numeric,
  hamburguesas integer,
  perros integer
)
language sql
stable
set search_path = public
as $$
  with o as (
    select id, created_at at time zone 'America/Bogota' as local_ts
      from public.orders
     where status = 'ENTREGADO'
       and created_at >= p_start
       and created_at < p_end
  ),
  addon_per_unit as (
    select a.order_item_id,
           sum(a.addon_price * a.quantity * case when a.target = 'EACH' then coalesce(a.components_qty, 1) else 1 end) as revenue,
           sum(a.unit_cost * a.quantity * case when a.target = 'EACH' then coalesce(a.components_qty, 1) else 1 end) as cost
      from public.order_item_addons a
      join public.order_items oi on oi.id = a.order_item_id
      join o on o.id = oi.order_id
     group by a.order_item_id
  )
  select oi.order_id,
         o.local_ts,
         case when oi.is_gift
              then 'regalo:' || coalesce(oi.product_id::text, oi.product_name)
              else coalesce(oi.product_id::text, 'nombre:' || oi.product_name)
         end,
         oi.product_id,
         case when oi.is_gift
              then 'Regalo: ' || coalesce(p.name, oi.product_name)
              else coalesce(p.name, oi.product_name)
         end,
         c.name,
         case when oi.is_gift then 0 else oi.quantity end,
         oi.line_total + coalesce(ap.revenue, 0) * oi.quantity,
         oi.unit_cost * oi.quantity + coalesce(ap.cost, 0) * oi.quantity,
         case when oi.is_gift then 0 else coalesce(p.conteo_hamburguesas, 0) * oi.quantity end,
         case when oi.is_gift then 0 else coalesce(p.conteo_perros, 0) * oi.quantity end
    from public.order_items oi
    join o on o.id = oi.order_id
    left join addon_per_unit ap on ap.order_item_id = oi.id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id;
$$;

revoke all on function public.sales_report_lines(timestamptz, timestamptz) from public, anon, authenticated;

-- 6) Reglas iniciales (desactivadas hasta que las revises en el panel) ----------
do $$
begin
  if not exists (select 1 from public.promotion_rules) then
    insert into public.promotion_rules (name, min_total, free_delivery, is_active)
    values
      ('Regalo sorpresa', 50000, false, false),
      ('Domicilio gratis', 90000, true, false);
  end if;
end;
$$;

commit;
