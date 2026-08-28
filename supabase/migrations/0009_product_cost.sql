-- 0009: Agrega costo manual por producto para la vista de rentabilidad.
-- El sistema no tenia costo por producto; este campo (default 0) se completa manualmente
-- y no afecta las formulas de Finanzas/Reportes ni el costo de produccion agregado.

alter table public.products
  add column cost numeric(12, 2) not null default 0
  check (cost >= 0);
