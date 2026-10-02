-- Auditoria 2026-10-02, bloque P0 (seguridad explotable hoy).
-- Todo restringe permisos; ningun cambio altera datos.

-- C1. analytics_*_fact (security_invoker=false) estaban concedidas a authenticated:
-- cualquier usuario podia leer todas las respuestas via REST. Las funciones report_*
-- eran SECURITY INVOKER y dependian de ese acceso; pasan a DEFINER (mismo resultado
-- que hoy, search_path ya fijado) y se revoca el acceso directo a las vistas.
alter function public.analytics_filtered_runs(jsonb) security definer;
alter function public.report_executive_summary(jsonb) security definer;
alter function public.report_filter_options(jsonb) security definer;
alter function public.report_monitor_detail(jsonb, integer, integer) security definer;
alter function public.report_question_results(jsonb) security definer;
revoke select on public.analytics_answer_fact, public.analytics_run_fact from authenticated, anon, public;
grant select on public.analytics_answer_fact, public.analytics_run_fact to powerbi_reader, service_role;

-- H1. Un usuario podia darse can_create_monitoreo, cambiar rei/ugel/area,
-- must_change_password, correo, documento... La policy self_update solo fijaba role.
-- Trigger NO definer: current_user es 'authenticated' solo en llamadas directas del cliente;
-- los triggers SECURITY DEFINER (p.ej. clear_initial_password_change...) y service_role pasan.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role is distinct from old.role
       or new.can_create_monitoreo is distinct from old.can_create_monitoreo
       or new.must_change_password is distinct from old.must_change_password
       or new.rei is distinct from old.rei
       or new.ugel is distinct from old.ugel
       or new.area is distinct from old.area
       or new.email is distinct from old.email
       or new.correo is distinct from old.correo
       or new.email_login is distinct from old.email_login
       or new.tipo_documento is distinct from old.tipo_documento
       or new.numero_documento is distinct from old.numero_documento
    then
      raise exception 'No autorizado: columnas protegidas del perfil' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists aa_guard_profile_privileged_columns on public.profiles;
create trigger aa_guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- C2. self_insert permitia crear un perfil propio con cualquier role (p.ej. admin).
-- Los perfiles se crean desde edge functions con service_role (bypass RLS).
drop policy if exists self_insert on public.profiles;

-- H2. El creador de una solicitud podia aprobarla el mismo (own_update sin limite de
-- columnas) y cualquiera podia insertar sin can_create_monitoreo().
create or replace function public.guard_solicitud_workflow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status is distinct from 'pending'
         or new.approved_by is not null or new.approved_at is not null
         or new.approved_lv1_by is not null or new.approved_lv1_at is not null then
        raise exception 'No autorizado: la solicitud debe iniciar en pending' using errcode = '42501';
      end if;
    else
      if new.approved_by is distinct from old.approved_by
         or new.approved_at is distinct from old.approved_at
         or new.approved_lv1_by is distinct from old.approved_lv1_by
         or new.approved_lv1_at is distinct from old.approved_lv1_at then
        raise exception 'No autorizado: campos de aprobacion' using errcode = '42501';
      end if;
      if new.status is distinct from old.status
         and not (old.status in ('approved', 'inactive') and new.status in ('approved', 'inactive')) then
        raise exception 'No autorizado: cambio de estado de la solicitud' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists aa_guard_solicitud_workflow on public.monitoreo_solicitud;
create trigger aa_guard_solicitud_workflow
  before insert or update on public.monitoreo_solicitud
  for each row execute function public.guard_solicitud_workflow();

drop policy if exists own_insert on public.monitoreo_solicitud;
create policy own_insert on public.monitoreo_solicitud
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_create_monitoreo());

-- H3 (parcial). Las rutas de firma solo las escribe la edge function (service_role).
create or replace function public.guard_run_signature_paths()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.docente_firma_path is distinct from old.docente_firma_path
       or new.monitor_firma_path is distinct from old.monitor_firma_path then
      raise exception 'No autorizado: rutas de firma' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists aa_guard_run_signature_paths on public.form_run;
create trigger aa_guard_run_signature_paths
  before update on public.form_run
  for each row execute function public.guard_run_signature_paths();

-- M2. Funciones que escriben o consultan permisos ejecutables sin login (anon via PUBLIC).
do $$
declare f text;
begin
  foreach f in array array[
    'public.populate_solicitud_ie(uuid)',
    'public.reconcile_role_assignments(uuid)',
    'public.set_monitoreo_role_assignment(uuid, text, boolean)',
    'public.sync_director_iiee_plazas()',
    'public.is_app_admin(uuid)',
    'public.director_iiee_can_access_institution(uuid, uuid)',
    'public.can_manage_app_module(text, uuid)',
    'public.can_create_monitoreo()',
    'public.get_my_director_iiee_scope()',
    'public.get_my_module_permissions()',
    'public.monitoring_cdd_registered_run_count(uuid[], boolean)',
    'public.monitoring_registered_run_counts(uuid[], boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
