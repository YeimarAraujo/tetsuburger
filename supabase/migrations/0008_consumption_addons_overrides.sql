-- ============================================================================
-- TETSUBURGER · Migración 0008 — Consumo de adiciones + Ajustes por pedido
-- 1) addon_consumptions: las adiciones (gaseosa extra, tocineta extra...)
--    consumen insumos de inventario y se suman al descuento automático.
-- 2) order_consumption_overrides: ajustes por pedido que reemplazan la
--    cantidad auto-calculada de un insumo específico (sin tomate → 0).
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Consumo de insumos por ADICIÓN (extras que descuentan inventario)
-- ----------------------------------------------------------------------------
create table public.addon_consumptions (
  id                uuid primary key default gen_random_uuid(),
  addon_id          uuid not null references public.addons (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity          numeric(12,3) not null check (quantity > 0),
  created_at        timestamptz not null default now(),
  unique (addon_id, inventory_item_id)
);
create index idx_addon_consumptions_addon on public.addon_consumptions (addon_id);

-- ----------------------------------------------------------------------------
-- Ajustes de consumo POR PEDIDO (sin tomate → 0, tocineta extra → +N)
-- ----------------------------------------------------------------------------
create table public.order_consumption_overrides (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  quantity          numeric(12,3) not null check (quantity >= 0),
  created_at        timestamptz not null default now(),
  unique (order_id, inventory_item_id)
);
create index idx_consumption_override_order on public.order_consumption_overrides (order_id);

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS
-- addon_consumptions: leídas/escritas por staff (configuración de adiciones).
-- order_consumption_overrides: leídas/escritas por staff (board) y por el
-- motor service_role al entregar.
-- ----------------------------------------------------------------------------
alter table public.addon_consumptions enable row level security;
alter table public.order_consumption_overrides enable row level security;

create policy "staff_read_addon_consumptions" on public.addon_consumptions
  for select using (public.is_staff());
create policy "staff_write_addon_consumptions" on public.addon_consumptions
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff_read_order_consumption_overrides" on public.order_consumption_overrides
  for select using (public.is_staff());
create policy "staff_write_order_consumption_overrides" on public.order_consumption_overrides
  for all using (public.is_staff()) with check (public.is_staff());
