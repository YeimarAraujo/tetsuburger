-- ============================================================================
-- Apariencia del sitio: bucket para logos y mascotas por tema (normal/navidad)
-- que el admin sube desde /admin/apariencia.
-- Las URLs se guardan en public.settings (claves appearance_*), así que no hay
-- cambios de esquema; solo el bucket y sus políticas.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

drop policy if exists "public_read_site_assets" on storage.objects;
create policy "public_read_site_assets" on storage.objects
  for select using (bucket_id = 'site-assets');

drop policy if exists "staff_insert_site_assets" on storage.objects;
create policy "staff_insert_site_assets" on storage.objects
  for insert with check (bucket_id = 'site-assets' and public.is_staff());

drop policy if exists "staff_update_site_assets" on storage.objects;
create policy "staff_update_site_assets" on storage.objects
  for update using (bucket_id = 'site-assets' and public.is_staff());

drop policy if exists "staff_delete_site_assets" on storage.objects;
create policy "staff_delete_site_assets" on storage.objects
  for delete using (bucket_id = 'site-assets' and public.is_staff());
