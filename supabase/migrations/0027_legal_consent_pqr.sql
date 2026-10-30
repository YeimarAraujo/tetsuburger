-- Cumplimiento legal: evidencia de consentimiento y canal PQR.
--
-- 1. Guarda en pedidos y reseñas la fecha de aceptación y la versión de la
--    política vigente (nullable para registros históricos).
-- 2. Crea la bandeja de PQR con RLS: solo staff puede leer/actualizar; las
--    inserciones públicas se hacen con service_role desde la server action.
--
-- Esta migración es aditiva e idempotente.

begin;

alter table public.orders
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists policy_version text;

alter table public.product_reviews
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists policy_version text;

create table if not exists public.pqr_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 80),
  email          text not null check (char_length(email) between 5 and 120),
  phone          text check (phone is null or char_length(phone) <= 20),
  type           text not null check (type in ('PEDIDO', 'PRODUCTO', 'PRIVACIDAD', 'OTRO')),
  message        text not null check (char_length(message) between 20 and 2000),
  status         text not null default 'NUEVO'
                 check (status in ('NUEVO', 'EN_PROCESO', 'CERRADO')),
  policy_version text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_pqr_requests_created_at
  on public.pqr_requests (created_at desc);
create index if not exists idx_pqr_requests_status
  on public.pqr_requests (status);

alter table public.pqr_requests enable row level security;

drop policy if exists "staff_all_pqr_requests" on public.pqr_requests;
create policy "staff_all_pqr_requests" on public.pqr_requests
  for all using (public.is_staff()) with check (public.is_staff());

-- El público no lee la bandeja; solo la server action (service_role) inserta.
revoke all on public.pqr_requests from anon;

commit;
