-- ============================================================================
-- TETSUBURGER · 0030 — El staff no puede cambiar su propio rol
-- La política "staff_update_own_profile" (0017) permite actualizar la fila
-- propia de profiles para guardar board_muted, pero RLS no restringe
-- columnas: un usuario no ADMIN podía cambiar su role_id a ADMIN.
-- Este trigger rechaza cualquier cambio de role_id (o de id) hecho por un
-- usuario autenticado que no sea ADMIN. El service_role y el SQL Editor
-- (auth.uid() nulo) siguen pudiendo asignar roles.
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

begin;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.role_id is distinct from old.role_id or new.id is distinct from old.id)
  then
    raise exception 'Solo un administrador puede cambiar roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

commit;
