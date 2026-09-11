-- ============================================================================
-- TETSUBURGER · Valor por consumo
-- Cada consumo de insumo de un producto guarda su propio valor unitario (COP).
-- Si es 0, el cálculo usa el costo global del insumo (inventory_items.cost).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter table public.product_consumptions
  add column if not exists unit_cost numeric(12, 2) not null default 0
  check (unit_cost >= 0);