-- Adiciones v2: en combos la adición puede apuntar a un producto concreto
-- ("a la hamburguesa", "al perro") o aplicarse a cada producto del combo.
-- `target` = 'EACH' | 'HAMBURGUESA' | 'PERRO' (null = aplica a todo el combo).
-- `components_qty` = cuántos productos del combo recibe la adición cuando
-- target = 'EACH' (suma de conteos). Con target distinto siempre es 1.

begin;

alter table public.order_item_addons
  add column if not exists target text,
  add column if not exists components_qty integer;

-- Sanidad: solo valores válidos. Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`,
-- se usa un DO para hacerla idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_item_addons_target_check'
      and conrelid = 'public.order_item_addons'::regclass
  ) then
    alter table public.order_item_addons
      add constraint order_item_addons_target_check
      check (target is null or target in ('EACH', 'HAMBURGUESA', 'PERRO'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_item_addons_components_check'
      and conrelid = 'public.order_item_addons'::regclass
  ) then
    alter table public.order_item_addons
      add constraint order_item_addons_components_check
      check (components_qty is null or (target = 'EACH' and components_qty >= 1));
  end if;
end $$;

-- Las filas históricas representan 1 unidad sin destino específico.
update public.order_item_addons
set target = null, components_qty = null
where target is null and components_qty is not null;

commit;