-- ============================================================================
-- TETSUBURGER · Esquema inicial
-- PostgreSQL / Supabase — single business, preparado para crecer
-- Ejecutar en Supabase SQL Editor (o supabase db push con CLI)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONES
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type public.order_origin as enum ('WEB', 'MANUAL');

create type public.order_status as enum (
  'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO',
  'EN_CAMINO', 'ENTREGADO', 'CANCELADO'
);

create type public.delivery_type as enum ('DOMICILIO', 'RECOGIDA', 'LOCAL');

create type public.movement_type as enum ('ENTRADA', 'SALIDA', 'AJUSTE', 'PRODUCCION');

-- ----------------------------------------------------------------------------
-- IDENTIDAD Y ACCESO
-- ----------------------------------------------------------------------------
create table public.roles (
  id   smallint generated always as identity primary key,
  name text not null unique
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role_id    smallint not null references public.roles (id),
  full_name  text not null default '',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CATÁLOGO
-- ----------------------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text not null default '',
  image_url     text not null default '',
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id) on delete restrict,
  name         text not null,
  slug         text not null unique,
  description  text not null default '',
  price        numeric(12,2) not null check (price >= 0),
  image_url    text not null default '',
  is_active    boolean not null default true,
  is_available boolean not null default true,   -- false = agotado hoy
  is_featured  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_products_category on public.products (category_id);

create table public.addons (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  price     numeric(12,2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_addons (
  product_id    uuid not null references public.products (id) on delete cascade,
  addon_id      uuid not null references public.addons (id) on delete cascade,
  display_order integer not null default 0,
  primary key (product_id, addon_id)
);

-- ----------------------------------------------------------------------------
-- PEDIDOS
-- Nota de integridad histórica: product_name/unit_price/addon_name/addon_price
-- son snapshots; NUNCA se recalculan con valores actuales del catálogo.
-- ----------------------------------------------------------------------------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        bigint generated always as identity unique,
  origin              public.order_origin not null default 'WEB',
  status              public.order_status not null default 'PENDIENTE',
  customer_name       text not null default '',
  customer_phone      text not null default '',
  customer_address    text not null default '',
  delivery_type       public.delivery_type not null default 'DOMICILIO',
  delivery_fee        numeric(12,2) not null default 0 check (delivery_fee >= 0),
  subtotal            numeric(12,2) not null default 0 check (subtotal >= 0),
  total               numeric(12,2) not null default 0 check (total >= 0),
  notes               text not null default '',
  created_by          uuid references public.profiles (id) on delete set null,
  confirmed_at        timestamptz,
  ready_at            timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_orders_created_at on public.orders (created_at desc);
create index idx_orders_status     on public.orders (status);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  quantity     integer not null check (quantity > 0),
  notes        text not null default '',
  line_total   numeric(12,2) generated always as (unit_price * quantity) stored
);
create index idx_order_items_order on public.order_items (order_id);

create table public.order_item_addons (
  id           uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  addon_id     uuid references public.addons (id) on delete set null,
  addon_name   text not null,
  addon_price  numeric(12,2) not null check (addon_price >= 0),
  quantity     integer not null default 1 check (quantity > 0)
);
create index idx_order_item_addons_item on public.order_item_addons (order_item_id);

create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_order_status_history_order on public.order_status_history (order_id);

-- ----------------------------------------------------------------------------
-- FINANZAS
-- ----------------------------------------------------------------------------
create table public.expense_categories (
  id        smallint generated always as identity primary key,
  name      text not null unique,
  is_active boolean not null default true
);

create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  expense_date        date not null default current_date,
  expense_category_id smallint not null references public.expense_categories (id) on delete restrict,
  concept             text not null,
  amount              numeric(12,2) not null check (amount >= 0),
  description         text not null default '',
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index idx_expenses_date on public.expenses (expense_date);

create table public.daily_closings (
  id              uuid primary key default gen_random_uuid(),
  closing_date    date not null unique,
  orders_count    integer not null default 0,
  sales_total     numeric(12,2) not null default 0,
  expenses_total  numeric(12,2) not null default 0,
  estimated_profit numeric(12,2) not null default 0,
  details         jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- INVENTARIO Y PRODUCCIÓN (esquema desde ya, operación en fase 3)
-- ----------------------------------------------------------------------------
create table public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  unit          text not null default 'unidad',
  current_stock numeric(12,3) not null default 0 check (current_stock >= 0),
  min_stock     numeric(12,3) not null default 0 check (min_stock >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  movement_type  public.movement_type not null,
  quantity       numeric(12,3) not null check (quantity <> 0),
  reference      text not null default '',
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index idx_inventory_movements_item on public.inventory_movements (inventory_item_id, created_at desc);

create table public.production_records (
  id                uuid primary key default gen_random_uuid(),
  record_date       date not null default current_date,
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  description       text not null,
  quantity          numeric(12,3) not null check (quantity > 0),
  unit              text not null default 'unidad',
  notes             text not null default '',
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_production_date on public.production_records (record_date);

-- ----------------------------------------------------------------------------
-- CONFIGURACIÓN Y CONTROL
-- ----------------------------------------------------------------------------
-- day_of_week: 0 = Domingo … 6 = Sábado (igual que Date.getDay() en JS).
-- closes_at puede ser menor que opens_at: se interpreta como cruce de medianoche.
create table public.business_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  opens_at    time not null,
  closes_at   time not null,
  is_active   boolean not null default true
);

create table public.special_closures (
  id        uuid primary key default gen_random_uuid(),
  date      date not null unique,
  reason    text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default true,  -- false => solo visible para staff
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  action     text not null,
  table_name text not null,
  record_id  text not null default '',
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_created on public.audit_logs (created_at desc);

-- ============================================================================
-- FUNCIONES AUXILIARES DE SEGURIDAD (evitan recursión de RLS en profiles)
-- ============================================================================
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.name = 'ADMIN'
  );
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- updated_at automático -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_addons_updated before update on public.addons
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();
create trigger trg_inventory_items_updated before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- Auditoría automática (insert-only; nadie puede editar audit_logs) ----------
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
  values (auth.uid(), tg_op, tg_table_name, v_rec, v_old, v_new);

  return coalesce(new, old);
end;
$$;

create trigger trg_audit_categories after insert or update or delete on public.categories
  for each row execute function public.handle_audit();
create trigger trg_audit_products after insert or update or delete on public.products
  for each row execute function public.handle_audit();
create trigger trg_audit_addons after insert or update or delete on public.addons
  for each row execute function public.handle_audit();
create trigger trg_audit_expenses after insert or update or delete on public.expenses
  for each row execute function public.handle_audit();
create trigger trg_audit_settings after insert or update or delete on public.settings
  for each row execute function public.handle_audit();
create trigger trg_audit_business_hours after insert or update or delete on public.business_hours
  for each row execute function public.handle_audit();
create trigger trg_audit_inventory_items after insert or update or delete on public.inventory_items
  for each row execute function public.handle_audit();

-- Historial de estados del pedido --------------------------------------------
create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());

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

create trigger trg_orders_status before update of status on public.orders
  for each row execute function public.handle_order_status_change();

-- Cierres diarios inmutables ---------------------------------------------------
create or replace function public.protect_daily_closings()
returns trigger language plpgsql as $$
begin
  raise exception 'Los cierres diarios son inmutables y no pueden modificarse ni eliminarse';
end;
$$;

create trigger trg_daily_closings_protect before update or delete on public.daily_closings
  for each row execute function public.protect_daily_closings();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Regla clave: el público anónimo SOLO lee catálogo/config pública.
-- La creación/modificación de pedidos y toda la escritura sensible ocurre en
-- el servidor Next.js (Server Actions) usando la service_role key, que ignora
-- RLS. No existen políticas INSERT/UPDATE/DELETE para anónimos en ninguna tabla.
-- ============================================================================
alter table public.roles                 enable row level security;
alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.addons                enable row level security;
alter table public.product_addons        enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_item_addons     enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.expense_categories    enable row level security;
alter table public.expenses              enable row level security;
alter table public.daily_closings        enable row level security;
alter table public.inventory_items       enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.production_records    enable row level security;
alter table public.business_hours        enable row level security;
alter table public.special_closures      enable row level security;
alter table public.settings              enable row level security;
alter table public.audit_logs            enable row level security;

-- Catálogo público: lectura solo de filas activas; staff ve todo -------------
create policy "public_read_categories" on public.categories
  for select using (is_active or public.is_staff());
create policy "staff_write_categories" on public.categories
  for all using (public.is_staff()) with check (public.is_staff());

create policy "public_read_products" on public.products
  for select using (is_active or public.is_staff());
create policy "staff_write_products" on public.products
  for all using (public.is_staff()) with check (public.is_staff());

create policy "public_read_addons" on public.addons
  for select using (is_active or public.is_staff());
create policy "staff_write_addons" on public.addons
  for all using (public.is_staff()) with check (public.is_staff());

create policy "read_product_addons" on public.product_addons
  for select using (
    public.is_staff()
    or exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "staff_write_product_addons" on public.product_addons
  for all using (public.is_staff()) with check (public.is_staff());

-- Pedidos: solo staff consulta; escritura exclusiva vía servidor --------------
create policy "staff_read_orders" on public.orders
  for select using (public.is_staff());
create policy "staff_read_order_items" on public.order_items
  for select using (public.is_staff());
create policy "staff_read_order_item_addons" on public.order_item_addons
  for select using (public.is_staff());
create policy "staff_read_order_status_history" on public.order_status_history
  for select using (public.is_staff());

-- Finanzas --------------------------------------------------------------------
create policy "staff_read_expense_categories" on public.expense_categories
  for select using (public.is_staff());
create policy "admin_write_expense_categories" on public.expense_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "staff_expenses" on public.expenses
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff_read_closings" on public.daily_closings
  for select using (public.is_staff());
-- Sin política de escritura: se insertan vía service_role; el trigger bloquea edición.

-- Inventario / producción ------------------------------------------------------
create policy "staff_inventory_items" on public.inventory_items
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_inventory_movements" on public.inventory_movements
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_production" on public.production_records
  for all using (public.is_staff()) with check (public.is_staff());

-- Horarios ----------------------------------------------------------------------
create policy "public_read_business_hours" on public.business_hours
  for select using (true);
create policy "staff_write_business_hours" on public.business_hours
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff_special_closures" on public.special_closures
  for all using (public.is_staff()) with check (public.is_staff());

-- Configuración: claves marcadas públicas son legibles por el catálogo ---------
create policy "read_public_settings" on public.settings
  for select using (is_public or public.is_staff());
create policy "staff_write_settings" on public.settings
  for all using (public.is_staff()) with check (public.is_staff());

-- Identidad ----------------------------------------------------------------------
create policy "staff_read_roles" on public.roles
  for select using (public.is_staff());
create policy "read_own_profile" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "admin_manage_profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Auditoría: lectura staff, sin políticas de escritura (insert-only vía trigger) --
create policy "staff_read_audit" on public.audit_logs
  for select using (public.is_staff());

-- ============================================================================
-- REALTIME: pedidos entrantes en vivo para el board del panel
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ============================================================================
-- STORAGE: imágenes de productos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "staff_insert_product_images" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_staff());

create policy "staff_update_product_images" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_staff());

create policy "staff_delete_product_images" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_staff());

-- ============================================================================
-- SEED INICIAL
-- ============================================================================
insert into public.roles (name) values ('ADMIN'), ('OPERADOR')
on conflict (name) do nothing;

insert into public.expense_categories (name) values
  ('Materia prima'), ('Empaques'), ('Servicios'), ('Publicidad'),
  ('Transporte'), ('Nómina'), ('Mantenimiento'), ('Otros')
on conflict (name) do nothing;

insert into public.categories (name, slug, display_order) values
  ('Hamburguesas', 'hamburguesas', 1),
  ('Combos', 'combos', 2),
  ('Perros Calientes', 'perros-calientes', 3),
  ('Papas', 'papas', 4),
  ('Bebidas', 'bebidas', 5),
  ('Promociones', 'promociones', 6)
on conflict (slug) do nothing;

insert into public.business_hours (day_of_week, opens_at, closes_at, is_active) values
  (0, '17:00', '23:00', true),
  (1, '17:00', '23:00', true),
  (2, '17:00', '23:00', true),
  (3, '17:00', '23:00', true),
  (4, '17:00', '23:00', true),
  (5, '17:00', '23:00', true),
  (6, '17:00', '23:00', true)
on conflict (day_of_week) do nothing;

insert into public.settings (key, value, is_public) values
  ('whatsapp_number', '"+573000000000"', true),
  ('delivery_fee', '5000', true),
  ('min_order_total', '0', true),
  ('currency', '"COP"', true),
  ('timezone', '"America/Bogota"', true),
  ('store_temporarily_closed', 'false', true),
  ('closed_message', '"Estamos cerrados temporalmente. Vuelve pronto."', true),
  ('banner_text', '"Hamburguesas artesanales a la parrilla"', true),
  ('hero_image', '""', true),
  ('address', '""', true),
  ('instagram_url', '""', true),
  ('facebook_url', '""', true),
  ('allow_orders_outside_hours', 'false', false)
on conflict (key) do nothing;
