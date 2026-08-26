-- Lectura global para modulo Indicadores CdD (solo visualizacion)
-- Permite que rol responsable_cdd vea todos los CdD en dashboard.

create or replace function public.is_responsable_cdd(uid uuid default auth.uid())
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
      and p.role = 'responsable_cdd'
  );
$$;

grant execute on function public.is_responsable_cdd(uuid) to authenticated;

-- Monitoreos / solicitudes (lectura)
drop policy if exists mon_catalog_select_responsable_cdd_read on public.monitoreo_catalog;
create policy mon_catalog_select_responsable_cdd_read
on public.monitoreo_catalog
for select
to authenticated
using (public.is_responsable_cdd());

drop policy if exists mon_solicitud_select_responsable_cdd_read on public.monitoreo_solicitud;
create policy mon_solicitud_select_responsable_cdd_read
on public.monitoreo_solicitud
for select
to authenticated
using (public.is_responsable_cdd());

-- Fichas / templates / preguntas (lectura)
drop policy if exists ficha_catalog_select_responsable_cdd_read on public.ficha_catalog;
create policy ficha_catalog_select_responsable_cdd_read
on public.ficha_catalog
for select
to authenticated
using (public.is_responsable_cdd());

drop policy if exists form_template_select_responsable_cdd_read on public.form_template;
create policy form_template_select_responsable_cdd_read
on public.form_template
for select
to authenticated
using (public.is_responsable_cdd());

drop policy if exists form_section_select_responsable_cdd_read on public.form_section;
create policy form_section_select_responsable_cdd_read
on public.form_section
for select
to authenticated
using (public.is_responsable_cdd());

drop policy if exists form_question_select_responsable_cdd_read on public.form_question;
create policy form_question_select_responsable_cdd_read
on public.form_question
for select
to authenticated
using (public.is_responsable_cdd());

drop policy if exists form_run_select_responsable_cdd_read on public.form_run;
create policy form_run_select_responsable_cdd_read
on public.form_run
for select
to authenticated
using (public.is_responsable_cdd());

drop policy if exists form_answer_select_responsable_cdd_read on public.form_answer;
create policy form_answer_select_responsable_cdd_read
on public.form_answer
for select
to authenticated
using (public.is_responsable_cdd());

-- Datos de responsables para mostrar nombre/area en indicadores
drop policy if exists profiles_select_responsable_cdd_read on public.profiles;
create policy profiles_select_responsable_cdd_read
on public.profiles
for select
to authenticated
using (public.is_responsable_cdd());

