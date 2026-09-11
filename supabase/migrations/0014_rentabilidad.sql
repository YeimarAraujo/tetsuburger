-- ============================================================================
-- TETSUBURGER · Rentabilidad con costo completo
-- Agrega el costo de empaque por producto para que el simulador de precios
-- pueda sumarlo al costo de ingredientes y cubrir el costo real del negocio.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter table public.products
  add column packaging_cost numeric(12, 2) not null default 0
  check (packaging_cost >= 0);