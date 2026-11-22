-- ============================================================================
-- TETSUBURGER · 0040 — Deuda de socios (módulo Caja)
-- Registro de lo que cada socio le debe a la caja:
--   * PRESTAMO: la caja le presta plata al socio (sale de una base elegida).
--   * ABONO:    el socio devuelve plata (entra a una base elegida).
-- Cada movimiento se liga a una fila de caja_movements (RETIRO − / INGRESO_EXTRA +)
-- para que los saldos de las bases reflejen lo que pasó en la práctica.
-- La deuda de un socio = Σ préstamos − Σ abonos (se calcula, no se guarda).
--
-- Si se borra el movimiento de caja ligado, se borra también el de socio.
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

create table if not exists public.caja_socios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (char_length(btrim(nombre)) between 2 and 80),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_caja_socios_nombre
  on public.caja_socios (lower(btrim(nombre)));

create table if not exists public.caja_socio_movimientos (
  id               uuid primary key default gen_random_uuid(),
  socio_id         uuid not null references public.caja_socios (id) on delete cascade,
  tipo             text not null check (tipo in ('PRESTAMO', 'ABONO')),
  movement_date    date not null default current_date,
  amount           numeric(12,2) not null check (amount > 0),
  metodo           text not null default 'EFECTIVO' check (metodo in ('EFECTIVO', 'TRANSFERENCIA')),
  bolsillo         text not null default 'GANANCIA' check (bolsillo in ('COMPRAS', 'GANANCIA')),
  description      text not null default '',
  caja_movement_id uuid references public.caja_movements (id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index if not exists idx_caja_socio_mov_socio
  on public.caja_socio_movimientos (socio_id, movement_date desc, created_at desc);

-- RLS: solo staff lee y escribe.
alter table public.caja_socios            enable row level security;
alter table public.caja_socio_movimientos enable row level security;

drop policy if exists "staff_caja_socios" on public.caja_socios;
create policy "staff_caja_socios" on public.caja_socios
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff_caja_socio_mov" on public.caja_socio_movimientos;
create policy "staff_caja_socio_mov" on public.caja_socio_movimientos
  for all using (public.is_staff()) with check (public.is_staff());

-- Auditoría (trigger genérico de 0001).
drop trigger if exists trg_audit_caja_socios on public.caja_socios;
create trigger trg_audit_caja_socios after insert or update or delete on public.caja_socios
  for each row execute function public.handle_audit();

drop trigger if exists trg_audit_caja_socio_mov on public.caja_socio_movimientos;
create trigger trg_audit_caja_socio_mov after insert or update or delete on public.caja_socio_movimientos
  for each row execute function public.handle_audit();
