-- Reseñas por producto: estrellas (1-5) + comentario, con moderación.
-- Opción híbrida: cualquiera puede reseñar; si la reseña viene de un pedido
-- verificado (order_id por confirmation_token) muestra badge de compra
-- verificada. Nacen PENDIENTE y el staff las aprueba desde /admin/resenas.

begin;

create table public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text not null default '' check (char_length(comment) <= 1000),
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  order_id      uuid references public.orders (id) on delete set null,
  status        text not null default 'PENDIENTE'
                check (status in ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  created_at    timestamptz not null default now()
);

create index idx_product_reviews_product on public.product_reviews (product_id, status);
create index idx_product_reviews_status  on public.product_reviews (status);
create index idx_product_reviews_order   on public.product_reviews (order_id);

-- Un solo comentario por producto por pedido verificado.
create unique index idx_product_reviews_order_product
  on public.product_reviews (order_id, product_id)
  where order_id is not null;

alter table public.product_reviews enable row level security;

-- Público (cliente web) solo ve aprobados; staff ve todo.
create policy "public_read_approved_reviews" on public.product_reviews
  for select using (status = 'APROBADO' or public.is_staff());

-- Escritura de staff vía servidor; las del público se insertan con service_role
-- (bypass RLS) desde la server action con rate limit.
create policy "staff_write_reviews" on public.product_reviews
  for all using (public.is_staff()) with check (public.is_staff());

commit;
