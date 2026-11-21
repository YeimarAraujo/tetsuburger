-- ============================================================================
-- TETSUBURGER · 0039 — Caja: saldo inicial de las dos bases
-- Ejecutar DESPUÉS de 0038 (y en una ejecución aparte: el tipo TRASLADO agregado
-- en 0038 no se puede usar en la misma transacción en que se crea).
--
-- Todo el historial de la caja quedó en la Base de Ganancia. La Base de Compras
-- se separa con un traslado inicial desde Ganancia:
--     $166.000 en efectivo + $352.000 en transferencia = $518.000
-- La Ganancia queda con el resto del saldo (lo que hay por encima de la base
-- de compras). El traslado se fecha en el primer día con movimientos para que
-- los saldos a fechas pasadas ya reflejen la separación.
--
-- Idempotente: no repite el traslado si ya existe.
-- ============================================================================

do $$
declare
  v_date date := coalesce(
    (select min(movement_date) from public.caja_movements),
    (now() at time zone 'America/Bogota')::date
  );
begin
  if not exists (
    select 1 from public.caja_movements
     where ref_type = 'traslado' and ref_id = 'saldo-inicial-efectivo'
  ) then
    insert into public.caja_movements
      (movement_date, tipo, metodo, bolsillo, amount, description, fuente, ref_type, ref_id)
    values
      (v_date, 'TRASLADO', 'EFECTIVO', 'GANANCIA', -166000,
       'Traslado a Base de Compras · saldo inicial', 'Traslado entre bases',
       'traslado', 'saldo-inicial-efectivo'),
      (v_date, 'TRASLADO', 'EFECTIVO', 'COMPRAS', 166000,
       'Traslado desde Base de Ganancia · saldo inicial', 'Traslado entre bases',
       'traslado', 'saldo-inicial-efectivo');
  end if;

  if not exists (
    select 1 from public.caja_movements
     where ref_type = 'traslado' and ref_id = 'saldo-inicial-transferencia'
  ) then
    insert into public.caja_movements
      (movement_date, tipo, metodo, bolsillo, amount, description, fuente, ref_type, ref_id)
    values
      (v_date, 'TRASLADO', 'TRANSFERENCIA', 'GANANCIA', -352000,
       'Traslado a Base de Compras · saldo inicial', 'Traslado entre bases',
       'traslado', 'saldo-inicial-transferencia'),
      (v_date, 'TRASLADO', 'TRANSFERENCIA', 'COMPRAS', 352000,
       'Traslado desde Base de Ganancia · saldo inicial', 'Traslado entre bases',
       'traslado', 'saldo-inicial-transferencia');
  end if;
end;
$$;
