-- ============================================================================
-- TETSUBURGER · 0034 — Consumos que siguen el costo del inventario
-- Al agregar un insumo a un producto, el formulario copiaba el costo vigente
-- del inventario en product_consumptions.unit_cost. Ese valor "propio" congela
-- el consumo: si luego cambia el costo del insumo, el trigger del inventario
-- (0033) solo recalcula los consumos con unit_cost = 0, así que el costo del
-- producto quedaba desactualizado.
--
-- Esta migración pone unit_cost = 0 en los consumos cuyo valor es IGUAL al
-- costo actual del insumo (una copia, no un valor propio). Los consumos con un
-- valor distinto se conservan: son ajustes deliberados por producto.
--
-- No cambia ningún costo hoy (el valor efectivo es el mismo). Idempotente.
-- Ejecutar en Supabase SQL Editor.
--
-- Para ver antes qué filas se afectan:
--   select p.name, ii.name as insumo, pc.unit_cost
--     from public.product_consumptions pc
--     join public.products p on p.id = pc.product_id
--     join public.inventory_items ii on ii.id = pc.inventory_item_id
--    where pc.unit_cost > 0 and pc.unit_cost = ii.cost;
-- ============================================================================

update public.product_consumptions pc
   set unit_cost = 0
  from public.inventory_items ii
 where ii.id = pc.inventory_item_id
   and pc.unit_cost > 0
   and pc.unit_cost = ii.cost;

-- Sincroniza los productos con receta (el resultado debe ser el mismo costo).
do $$
declare
  v_id uuid;
begin
  for v_id in select distinct product_id from public.product_consumptions loop
    perform public.recalc_product_cost(v_id);
  end loop;
end;
$$;
