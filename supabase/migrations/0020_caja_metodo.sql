-- ============================================================================
-- TETSUBURGER · 0020 — Caja y Pagos: canal del movimiento (efectivo / transferencia)
-- Cada movimiento de caja registra por qué medio entró o salió el dinero, para
-- poder mostrar saldos separados (efectivo, transferencia y total).
-- Los movimientos preexistentes quedan clasificados como EFECTIVO (la caja
-- histórica es la caja física).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter table public.caja_movements
  add column if not exists metodo text not null default 'EFECTIVO'
  check (metodo in ('EFECTIVO', 'TRANSFERENCIA'));