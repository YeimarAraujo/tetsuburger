-- ============================================================================
-- TETSUBURGER · 0033 — Costos confiables y reportes de ventas
-- 1) Costo del producto automático: si un producto tiene receta (consumos),
--    products.cost = Σ cantidad × valor del insumo + empaque, y se recalcula
--    solo cuando cambia la receta, el costo de un insumo o el empaque.
--    Los productos sin receta conservan su costo manual.
-- 2) Costo histórico: cada línea de pedido (y cada adicional) guarda su costo
--    al momento de la venta. Subir un costo hoy ya no cambia la utilidad de
--    meses pasados. Las ventas anteriores se completan con el costo actual.
-- 3) Gastos ya incluidos en el costo del producto (Empaques): se muestran
--    pero no se restan otra vez de la utilidad.
-- 4) sales_report(desde, hasta): agregados de ventas ENTREGADAS calculados en
--    la base de datos (sin límite de filas), para Reportes y Rentabilidad.
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

-- 1) Costo automático del producto -------------------------------------------
create or replace function public.product_recipe_cost(p_product_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    pc.quantity * case when pc.unit_cost > 0 then pc.unit_cost else coalesce(ii.cost, 0) end
  ), 0)
  from public.product_consumptions pc
  left join public.inventory_items ii on ii.id = pc.inventory_item_id
  where pc.product_id = p_product_id;
$$;

create or replace function public.recalc_product_cost(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric;
begin
  if not exists (select 1 from public.product_consumptions where product_id = p_product_id) then
    return; -- sin receta: el costo es manual
  end if;

  select round(public.product_recipe_cost(p.id) + coalesce(p.packaging_cost, 0), 2)
    into v_cost
    from public.products p
   where p.id = p_product_id;

  update public.products
     set cost = v_cost
   where id = p_product_id
     and cost is distinct from v_cost;
end;
$$;

-- Al guardar el producto (empaque o costo) con receta, el costo se recalcula.
create or replace function public.trg_products_auto_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.product_consumptions where product_id = new.id) then
    new.cost := round(public.product_recipe_cost(new.id) + coalesce(new.packaging_cost, 0), 2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_auto_cost on public.products;
create trigger trg_products_auto_cost
  before update of cost, packaging_cost on public.products
  for each row execute function public.trg_products_auto_cost();

create or replace function public.trg_consumption_recalc_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalc_product_cost(new.product_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.product_id <> new.product_id) then
    perform public.recalc_product_cost(old.product_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_consumption_recalc_cost on public.product_consumptions;
create trigger trg_consumption_recalc_cost
  after insert or update or delete on public.product_consumptions
  for each row execute function public.trg_consumption_recalc_cost();

create or replace function public.trg_inventory_cost_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_product_cost(pc.product_id)
     from (
       select distinct product_id
         from public.product_consumptions
        where inventory_item_id = new.id
          and unit_cost = 0
     ) pc;
  return null;
end;
$$;

drop trigger if exists trg_inventory_cost_recalc on public.inventory_items;
create trigger trg_inventory_cost_recalc
  after update of cost on public.inventory_items
  for each row
  when (old.cost is distinct from new.cost)
  execute function public.trg_inventory_cost_recalc();

-- Sincroniza hoy todos los productos con receta.
do $$
declare
  v_id uuid;
begin
  for v_id in select distinct product_id from public.product_consumptions loop
    perform public.recalc_product_cost(v_id);
  end loop;
end;
$$;

-- 2) Costo histórico por línea de pedido -------------------------------------
alter table public.order_items
  add column if not exists unit_cost numeric(12, 2) not null default 0;
alter table public.order_item_addons
  add column if not exists unit_cost numeric(12, 2) not null default 0;

create or replace function public.addon_unit_cost(p_addon_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(ac.quantity * coalesce(ii.cost, 0)), 0)
  from public.addon_consumptions ac
  left join public.inventory_items ii on ii.id = ac.inventory_item_id
  where ac.addon_id = p_addon_id;
$$;

create or replace function public.trg_order_item_snapshot_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.unit_cost = 0 and new.product_id is not null then
    select coalesce(cost, 0) into new.unit_cost from public.products where id = new.product_id;
    new.unit_cost := coalesce(new.unit_cost, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_item_snapshot_cost on public.order_items;
create trigger trg_order_item_snapshot_cost
  before insert on public.order_items
  for each row execute function public.trg_order_item_snapshot_cost();

create or replace function public.trg_order_item_addon_snapshot_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.unit_cost = 0 and new.addon_id is not null then
    new.unit_cost := round(public.addon_unit_cost(new.addon_id), 2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_item_addon_snapshot_cost on public.order_item_addons;
create trigger trg_order_item_addon_snapshot_cost
  before insert on public.order_item_addons
  for each row execute function public.trg_order_item_addon_snapshot_cost();

-- Ventas anteriores: se completan con el costo actual (mejor dato disponible).
update public.order_items oi
   set unit_cost = p.cost
  from public.products p
 where p.id = oi.product_id
   and oi.unit_cost = 0
   and p.cost > 0;

update public.order_item_addons
   set unit_cost = round(public.addon_unit_cost(addon_id), 2)
 where addon_id is not null
   and unit_cost = 0;

-- 3) Gastos ya incluidos en el costo del producto -----------------------------
alter table public.expense_categories
  add column if not exists included_in_product_cost boolean not null default false;

update public.expense_categories
   set included_in_product_cost = true
 where name = 'Empaques';

-- 4) Reporte de ventas entregadas --------------------------------------------
-- Líneas vendidas (producto + sus adicionales) de pedidos ENTREGADO.
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
         coalesce(oi.product_id::text, 'nombre:' || oi.product_name),
         oi.product_id,
         coalesce(p.name, oi.product_name),
         c.name,
         oi.quantity,
         oi.line_total + coalesce(ap.revenue, 0) * oi.quantity,
         oi.unit_cost * oi.quantity + coalesce(ap.cost, 0) * oi.quantity,
         coalesce(p.conteo_hamburguesas, 0) * oi.quantity,
         coalesce(p.conteo_perros, 0) * oi.quantity
    from public.order_items oi
    join o on o.id = oi.order_id
    left join addon_per_unit ap on ap.order_item_id = oi.id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id;
$$;

create or replace function public.sales_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_totals jsonb;
  v_products jsonb;
  v_addons jsonb;
  v_daily jsonb;
  v_heatmap jsonb;
  v_status jsonb;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Rango de fechas inválido (máximo 400 días)' using errcode = 'P0001';
  end if;

  v_start := (p_from::text || ' 00:00:00-05')::timestamptz;
  v_end := ((p_to + 1)::text || ' 00:00:00-05')::timestamptz;

  select jsonb_build_object(
           'orders', count(*),
           'gross', coalesce(sum(subtotal), 0),
           'adjustments', coalesce(sum(coalesce(final_adjustment, 0)), 0),
           'sales', coalesce(sum(subtotal - coalesce(final_adjustment, 0)), 0)
         )
    into v_totals
    from public.orders
   where status = 'ENTREGADO' and created_at >= v_start and created_at < v_end;

  v_totals := v_totals || (
    select jsonb_build_object(
             'cost', coalesce(sum(cost), 0),
             'units', coalesce(sum(quantity), 0),
             'hamburguesas', coalesce(sum(hamburguesas), 0),
             'perros', coalesce(sum(perros), 0)
           )
      from public.sales_report_lines(v_start, v_end)
  );

  select jsonb_build_object(
           'in_progress', count(*) filter (where status not in ('ENTREGADO', 'CANCELADO')),
           'cancelled', count(*) filter (where status = 'CANCELADO')
         )
    into v_status
    from public.orders
   where created_at >= v_start and created_at < v_end;

  select coalesce(jsonb_agg(row_to_json(t) order by t.units desc, t.revenue desc), '[]'::jsonb)
    into v_products
    from (
      select product_key as key,
             max(product_id::text) as product_id,
             max(product_name) as name,
             max(category_name) as category,
             sum(quantity) as units,
             count(distinct order_id) as orders,
             sum(revenue) as revenue,
             sum(cost) as cost,
             sum(hamburguesas) as hamburguesas,
             sum(perros) as perros
        from public.sales_report_lines(v_start, v_end)
       group by product_key
    ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.units desc, t.revenue desc), '[]'::jsonb)
    into v_addons
    from (
      select coalesce(a.addon_id::text, 'nombre:' || a.addon_name) as key,
             max(a.addon_name) as name,
             sum(a.quantity * case when a.target = 'EACH' then coalesce(a.components_qty, 1) else 1 end * oi.quantity) as units,
             sum(a.addon_price * a.quantity * case when a.target = 'EACH' then coalesce(a.components_qty, 1) else 1 end * oi.quantity) as revenue,
             sum(a.unit_cost * a.quantity * case when a.target = 'EACH' then coalesce(a.components_qty, 1) else 1 end * oi.quantity) as cost
        from public.order_item_addons a
        join public.order_items oi on oi.id = a.order_item_id
        join public.orders o on o.id = oi.order_id
       where o.status = 'ENTREGADO' and o.created_at >= v_start and o.created_at < v_end
       group by 1
    ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.date), '[]'::jsonb)
    into v_daily
    from (
      select (o.created_at at time zone 'America/Bogota')::date as date,
             count(*) as orders,
             sum(o.subtotal - coalesce(o.final_adjustment, 0)) as sales,
             coalesce(sum(lc.cost), 0) as cost
        from public.orders o
        left join (
          select l.order_id, sum(l.cost) as cost
            from public.sales_report_lines(v_start, v_end) l
           group by l.order_id
        ) lc
          on lc.order_id = o.id
       where o.status = 'ENTREGADO' and o.created_at >= v_start and o.created_at < v_end
       group by 1
    ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_heatmap
    from (
      select extract(dow from local_at)::int as dow,
             extract(hour from local_at)::int as hour,
             count(*) as orders,
             sum(subtotal - coalesce(final_adjustment, 0)) as sales
        from (
          select created_at at time zone 'America/Bogota' as local_at, subtotal, final_adjustment
            from public.orders
           where status = 'ENTREGADO' and created_at >= v_start and created_at < v_end
        ) x
       group by 1, 2
    ) t;

  return jsonb_build_object(
    'totals', v_totals || v_status,
    'products', v_products,
    'addons', v_addons,
    'daily', v_daily,
    'heatmap', v_heatmap
  );
end;
$$;

revoke all on function public.sales_report_lines(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sales_report(date, date) from public, anon;
grant execute on function public.sales_report(date, date) to authenticated, service_role;

commit;
