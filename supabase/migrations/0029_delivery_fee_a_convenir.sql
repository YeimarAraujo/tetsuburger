-- Permite activar/desactivar el valor del domicilio "a convenir"
-- en lugar de un monto fijo en checkout y resumen.
insert into public.settings (key, value, is_public)
values ('delivery_fee_a_convenir', true::jsonb, true)
on conflict (key) do update set value = excluded.value;
