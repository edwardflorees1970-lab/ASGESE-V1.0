-- Permite que admin o propietario de la solicitud gestione templates/fichas
-- cuando corresponda al monitoreo de su solicitud, sin abrir acceso global.

create or replace function public.is_admin_user(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

create or replace function public.can_manage_solicitud(p_solicitud_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_user(uid)
    or exists (
      select 1
      from public.monitoreo_solicitud s
      where s.id = p_solicitud_id
        and s.created_by = uid
    );
$$;

create or replace function public.can_manage_template(p_template_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.form_template t
    where t.id = p_template_id
      and public.can_manage_solicitud(t.solicitud_id, uid)
  );
$$;

create or replace function public.can_manage_monitoreo(p_monitoreo_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_user(uid)
    or exists (
      select 1
      from public.monitoreo_catalog m
      join public.monitoreo_solicitud s on s.id = m.solicitud_id
      where m.id = p_monitoreo_id
        and s.created_by = uid
    );
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.can_manage_solicitud(uuid, uuid) to authenticated;
grant execute on function public.can_manage_template(uuid, uuid) to authenticated;
grant execute on function public.can_manage_monitoreo(uuid, uuid) to authenticated;

-- form_template
drop policy if exists form_template_manage_owner_admin_ins on public.form_template;
create policy form_template_manage_owner_admin_ins
on public.form_template
for insert
to authenticated
with check (public.can_manage_solicitud(solicitud_id));

drop policy if exists form_template_manage_owner_admin_upd on public.form_template;
create policy form_template_manage_owner_admin_upd
on public.form_template
for update
to authenticated
using (public.can_manage_solicitud(solicitud_id))
with check (public.can_manage_solicitud(solicitud_id));

drop policy if exists form_template_manage_owner_admin_del on public.form_template;
create policy form_template_manage_owner_admin_del
on public.form_template
for delete
to authenticated
using (public.can_manage_solicitud(solicitud_id));

-- form_section
drop policy if exists form_section_manage_owner_admin_ins on public.form_section;
create policy form_section_manage_owner_admin_ins
on public.form_section
for insert
to authenticated
with check (public.can_manage_template(template_id));

drop policy if exists form_section_manage_owner_admin_upd on public.form_section;
create policy form_section_manage_owner_admin_upd
on public.form_section
for update
to authenticated
using (public.can_manage_template(template_id))
with check (public.can_manage_template(template_id));

drop policy if exists form_section_manage_owner_admin_del on public.form_section;
create policy form_section_manage_owner_admin_del
on public.form_section
for delete
to authenticated
using (public.can_manage_template(template_id));

-- form_question
drop policy if exists form_question_manage_owner_admin_ins on public.form_question;
create policy form_question_manage_owner_admin_ins
on public.form_question
for insert
to authenticated
with check (public.can_manage_template(template_id));

drop policy if exists form_question_manage_owner_admin_upd on public.form_question;
create policy form_question_manage_owner_admin_upd
on public.form_question
for update
to authenticated
using (public.can_manage_template(template_id))
with check (public.can_manage_template(template_id));

drop policy if exists form_question_manage_owner_admin_del on public.form_question;
create policy form_question_manage_owner_admin_del
on public.form_question
for delete
to authenticated
using (public.can_manage_template(template_id));

-- ficha_catalog (alta/edición de habilitación por dueño/admin del monitoreo)
drop policy if exists ficha_catalog_manage_owner_admin_ins on public.ficha_catalog;
create policy ficha_catalog_manage_owner_admin_ins
on public.ficha_catalog
for insert
to authenticated
with check (
  public.can_manage_monitoreo(monitoreo_id)
  and (form_template_id is null or public.can_manage_template(form_template_id))
);

drop policy if exists ficha_catalog_manage_owner_admin_upd on public.ficha_catalog;
create policy ficha_catalog_manage_owner_admin_upd
on public.ficha_catalog
for update
to authenticated
using (public.can_manage_monitoreo(monitoreo_id))
with check (
  public.can_manage_monitoreo(monitoreo_id)
  and (form_template_id is null or public.can_manage_template(form_template_id))
);

-- monitoreo_catalog (sincronización de nombre/fechas por dueño/admin)
drop policy if exists monitoreo_catalog_manage_owner_admin_upd on public.monitoreo_catalog;
create policy monitoreo_catalog_manage_owner_admin_upd
on public.monitoreo_catalog
for update
to authenticated
using (
  solicitud_id is not null
  and public.can_manage_solicitud(solicitud_id)
)
with check (
  solicitud_id is not null
  and public.can_manage_solicitud(solicitud_id)
);
