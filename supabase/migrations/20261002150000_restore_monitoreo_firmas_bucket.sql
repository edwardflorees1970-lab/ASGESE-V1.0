-- Auditoria 2026-10-02: el bucket monitoreo-firmas no existia en produccion (0 buckets).
-- Se recrea con la config final (PNG+JPEG, 6 MB) y la policy de lectura original.
-- Escritura solo via Edge Function (service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('monitoreo-firmas', 'monitoreo-firmas', false, 6291456, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 6291456, allowed_mime_types = array['image/png', 'image/jpeg'];

drop policy if exists firmas_objects_read on storage.objects;
create policy firmas_objects_read on storage.objects for select to authenticated
using (
  bucket_id = 'monitoreo-firmas'
  and (
    public.is_admin_user(auth.uid())
    or exists (
      select 1 from public.form_run fr
      where fr.id::text = (storage.foldername(name))[1]
        and fr.created_by = auth.uid()
    )
  )
);
