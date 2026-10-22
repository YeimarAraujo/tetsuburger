-- Rate limit persistente (ventana fija) para Server Actions y Route Handlers.
--
-- La clave se guarda hasheada (SHA-256) desde la aplicación, así que la tabla
-- no contiene correos ni IPs en claro. La función es atómica: el UPSERT
-- resuelve la ventana y el conteo en una sola sentencia.
--
-- Solo el backend (service_role) puede ejecutarla. La tabla no es accesible
-- con la clave anon.

begin;

create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key text,
  p_window_ms bigint,
  p_max integer
)
returns table (allowed boolean, remaining integer, retry_after_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := clock_timestamp();
  v_window interval := make_interval(
    secs => (p_window_ms::double precision / 1000.0)
  );
  v_row    public.rate_limits%rowtype;
begin
  if p_window_ms <= 0 or p_max <= 0 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.rate_limits as rl (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when rl.window_start <= v_now - v_window then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start <= v_now - v_window then v_now
          else rl.window_start
        end
  returning * into v_row;

  allowed := v_row.count <= p_max;
  remaining := greatest(p_max - v_row.count, 0);
  retry_after_ms := greatest(
    ceil(extract(epoch from (v_row.window_start + v_window - v_now)) * 1000)::bigint,
    0
  );

  -- Limpieza oportunista: las claves no se necesitan más de 2 días.
  if random() < 0.05 then
    delete from public.rate_limits where window_start < v_now - interval '2 days';
  end if;

  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text, bigint, integer) from public;
grant execute on function public.consume_rate_limit(text, bigint, integer) to service_role;

commit;
