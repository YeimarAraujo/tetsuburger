-- Marca adiciones que son bebidas/paquetes y por tanto NO llevan destino a un
-- producto concreto del combo (la hamburguesa o el perro). En el selector web
-- solo muestran el control de cantidad, sin el bloque de combos.

begin;

alter table public.addons
  add column if not exists es_bebida boolean not null default false;

commit;