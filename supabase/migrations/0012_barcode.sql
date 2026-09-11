-- ============================================================================
-- TETSUBURGER · Códigos de barras
-- Permite escanear con un lector USB en Compras e Inventario y prellenar el
-- insumo. El barcode es opcional y único solo cuando está definido
-- (índice parcial), así varias filas pueden estar vacías.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter table public.inventory_items
  add column barcode text;

alter table public.products
  add column barcode text;

create unique index idx_inventory_items_barcode
  on public.inventory_items (barcode)
  where barcode is not null;

create unique index idx_products_barcode
  on public.products (barcode)
  where barcode is not null;