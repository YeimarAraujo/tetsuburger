-- ============================================================================
-- TETSUBURGER · Migración 0007 — Normalización de unidades
-- Convierte las abreviaturas duplicadas al nombre completo estándar.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- inventory_items
update public.inventory_items set unit = 'unidad' where unit = 'und';
update public.inventory_items set unit = 'gramos' where unit = 'g';
update public.inventory_items set unit = 'litro'  where unit = 'L' or unit = 'l';
update public.inventory_items set unit = 'gramos' where lower(unit) = 'gramo';
update public.inventory_items set unit = 'litro'  where lower(unit) = 'lt';

-- production_records (histórico; no afecta stock actual)
update public.production_records set unit = 'unidad' where unit = 'und';
update public.production_records set unit = 'gramos' where unit = 'g';
update public.production_records set unit = 'litro'  where unit = 'L' or unit = 'l';
