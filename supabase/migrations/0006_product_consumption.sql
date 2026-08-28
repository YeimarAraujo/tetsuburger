-- ============================================================================
-- TETSUBURGER · Migración 0006 — Consumo de insumos por producto
-- Permite automatizar el descuento de inventario al marcar un pedido como
-- ENTREGADO, según los insumos que consume cada producto.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Consumos por producto: ingredientes + empaque (bolsa, potesito, porta...)
-- ----------------------------------------------------------------------------
create table public.product_consumptions (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity          numeric(12,3) not null check (quantity > 0),
  created_at        timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);
create index idx_product_consumptions_product on public.product_consumptions (product_id);

-- ----------------------------------------------------------------------------
-- Registro immutable de qué se descontó y en qué pedido (trazabilidad)
-- ----------------------------------------------------------------------------
create table public.order_consumption_logs (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id),
  quantity          numeric(12,3) not null check (quantity > 0),
  product_reference text not null default '',
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_consumption_log_order on public.order_consumption_logs (order_id);
create index idx_consumption_log_item on public.order_consumption_logs (inventory_item_id);

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS
-- product_consumptions: legibles por el staff (catálogo/admin) y escribibles
-- solo por staff autenticado.
-- order_consumption_logs: legibles por staff; la escritura real la hace
-- service_role (descuento automático), pero se permite lectura a staff.
-- ----------------------------------------------------------------------------
alter table public.product_consumptions enable row level security;
alter table public.order_consumption_logs enable row level security;

create policy "staff_read_product_consumptions" on public.product_consumptions
  for select using (public.is_staff());
create policy "staff_write_product_consumptions" on public.product_consumptions
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff_read_consumption_logs" on public.order_consumption_logs
  for select using (public.is_staff());
