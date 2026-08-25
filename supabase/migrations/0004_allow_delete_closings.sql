-- Permite eliminar cierres diarios (corrección de errores)
-- pero mantiene la protección contra UPDATE (no se puede editar, solo borrar y recrear)
CREATE OR REPLACE FUNCTION public.protect_daily_closings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    raise exception 'Los cierres diarios son inmutables. Para corregir: borra el cierre y créalo de nuevo.';
  END IF;
  -- DELETE permitido (corrección de errores)
  RETURN OLD;
END;
$$;
