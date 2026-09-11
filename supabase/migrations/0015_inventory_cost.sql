-- ============================================================================
-- TETSUBURGER · Costo unitario por insumo
-- Permite calcular el costo de un producto automáticamente a partir de sus
-- consumos: costo ingredientes = Σ (cantidad consumida × costo del insumo),
-- más el empaque. El costo del insumo se mantiene al día al registrar compras.
-- Idempotente: seguro de ejecutar varias veces.
-- ============================================================================

alter table public.inventory_items
  add column if not exists cost numeric(12, 2) not null default 0
  check (cost >= 0);