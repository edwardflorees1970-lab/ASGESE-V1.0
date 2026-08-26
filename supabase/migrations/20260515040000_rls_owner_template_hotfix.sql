-- Hotfix RLS: asegura que owner/admin puedan crear templates sin bloqueo.

-- 1) Asegurar lectura de solicitud para owner/admin (evita falsos negativos en subconsultas RLS)
drop policy if exists monitoreo_solicitud_owner_admin_select on public.monitoreo_solicitud;
create policy monitoreo_solicitud_owner_admin_select
on public.monitoreo_solicitud
for select
to authenticated
using (
  public.is_admin_user()
  or created_by = auth.uid()
);

-- 2) Policies directas en form_template para owner/admin
drop policy if exists form_template_owner_admin_select on public.form_template;
create policy form_template_owner_admin_select
on public.form_template
for select
to authenticated
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.monitoreo_solicitud s
    where s.id = form_template.solicitud_id
      and s.created_by = auth.uid()
  )
);

drop policy if exists form_template_owner_admin_insert_direct on public.form_template;
create policy form_template_owner_admin_insert_direct
on public.form_template
for insert
to authenticated
with check (
  public.is_admin_user()
  or exists (
    select 1
    from public.monitoreo_solicitud s
    where s.id = form_template.solicitud_id
      and s.created_by = auth.uid()
  )
);

drop policy if exists form_template_owner_admin_update_direct on public.form_template;
create policy form_template_owner_admin_update_direct
on public.form_template
for update
to authenticated
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.monitoreo_solicitud s
    where s.id = form_template.solicitud_id
      and s.created_by = auth.uid()
  )
)
with check (
  public.is_admin_user()
  or exists (
    select 1
    from public.monitoreo_solicitud s
    where s.id = form_template.solicitud_id
      and s.created_by = auth.uid()
  )
);

drop policy if exists form_template_owner_admin_delete_direct on public.form_template;
create policy form_template_owner_admin_delete_direct
on public.form_template
for delete
to authenticated
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.monitoreo_solicitud s
    where s.id = form_template.solicitud_id
      and s.created_by = auth.uid()
  )
);
