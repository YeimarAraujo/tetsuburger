-- ============================================================================
-- TETSUBURGER · Módulo Caja
-- Ledger de efectivo: arqueo diario + pagos adicionales.
-- amount con signo: POSITIVO = entra a la caja, NEGATIVO = sale.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

create type public.caja_tipo as enum (
  'VENTA_EFECTIVO',  -- + auto: pedido ENTREGADO pagado en efectivo
  'COMPRA',          -- - auto: compra de materia prima marcada "sale de caja"
  'GASTO',           -- - auto: gasto marcado "sale de caja"
  'INGRESO_EXTRA',   -- + manual: pago adicional que llega a la caja
  'RETIRO',          -- - manual: plata que saca el dueño
  'AJUSTE'           -- ± manual: sobrante/faltante del arqueo
);

create table public.caja_movements (
  id            uuid primary key default gen_random_uuid(),
  movement_date date not null default current_date,
  tipo          public.caja_tipo not null,
  amount        numeric(12,2) not null check (amount <> 0),
  description   text not null default '',
  fuente        text not null default '',
  ref_type      text,
  ref_id        text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index idx_caja_movements_date on public.caja_movements (movement_date, created_at desc);

-- Las compras y gastos guardan si la plata salió de la caja (lo deja constancia
-- y permite corregirlo en edición).
alter table public.production_records add column from_caja boolean not null default false;
alter table public.expenses         add column from_caja boolean not null default false;

-- RLS: staff lo lee y escribe (las escrituras automáticas usan service_role).
alter table public.caja_movements enable row level security;
create policy "staff_caja" on public.caja_movements
  for all using (public.is_staff()) with check (public.is_staff());

-- Auditoría: la caja registra todo cambio (trigger insert/update/delete de 0001).
create trigger trg_audit_caja after insert or update or delete on public.caja_movements
  for each row execute function public.handle_audit();