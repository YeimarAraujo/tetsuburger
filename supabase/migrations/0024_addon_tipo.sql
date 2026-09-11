-- Reemplaza el flag booleano `es_bebida` (0023) por un tipo de adición:
--   'ALIMENTO'        -> se agrega a un producto concreto del combo (hamburguesa/perro).
--   'ACOMPAÑAMIENTO'  -> gaseosas, porción de papas, paquetes: en la web solo cantidad,
--                        sin selector de destino dentro del combo.
-- Los adicionales existentes quedan como 'ALIMENTO' (comportamiento previo).

begin;

alter table public.addons
  add column if not exists tipo text not null default 'ALIMENTO';

-- Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`: guard se hace con DO.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'addons_tipo_check'
      and conrelid = 'public.addons'::regclass
  ) then
    alter table public.addons
      add constraint addons_tipo_check
      check (tipo in ('ALIMENTO', 'ACOMPAÑAMIENTO'));
  end if;
end $$;

alter table public.addons
  drop column if exists es_bebida;

commit;