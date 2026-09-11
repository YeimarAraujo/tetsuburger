-- ============================================================================
-- TETSUBURGER · 0018 · Conteo de hamburguesas y perros vendidos
-- ============================================================================
-- Cada producto indica cuántas hamburguesas y perros contiene cada unidad
-- vendida (útil para combos). El conteo de ventas en Reportes se deriva de
--   cantidad × conteo  por línea, SIN intervención al registrar el pedido.

-- ----------------------------------------------------------------------------
-- 1) Columnas en products
-- ----------------------------------------------------------------------------
alter table public.products
  add column if not exists conteo_hamburguesas integer not null default 0;
alter table public.products
  add constraint products_conteo_hamburguesas_check
  check (conteo_hamburguesas >= 0);

alter table public.products
  add column if not exists conteo_perros integer not null default 0;
alter table public.products
  add constraint products_conteo_perros_check
  check (conteo_perros >= 0);

-- ----------------------------------------------------------------------------
-- 2) Clasificación inicial por nombre (mismo mapa que usa el fallback de código)
-- ----------------------------------------------------------------------------
update public.products set
  conteo_hamburguesas = case
    when name in ('Combo #1') then 2
    when name in ('Combo #2') then 1
    when name in ('Burger clasic', 'Burger Doble', 'La tetsu') or lower(name) like '%hamburguesa%' then 1
    else 0
  end,
  conteo_perros = case
    when name in ('Combo #2') then 1
    when name in ('Perro clasic', 'Perro Tetsu') or lower(name) like '%perro%' then 1
    else 0
  end;