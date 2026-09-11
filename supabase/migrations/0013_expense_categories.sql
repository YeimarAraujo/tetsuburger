-- ============================================================================
-- TETSUBURGER · Categorías de gasto más claras
-- Renombra la categoría genérica "Servicios" a "Servicios públicos" (gas, luz,
-- agua) y agrega "Entrega" para domicilios. Los gastos existentes conservan su
-- categoría porque se referencian por id, no por nombre.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

update public.expense_categories
  set name = 'Servicios públicos'
  where name = 'Servicios';

insert into public.expense_categories (name) values ('Entrega')
on conflict (name) do nothing;