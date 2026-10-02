-- Auditoria 2026-10-02: integridad de datos (aplicada en produccion via MCP; versionada aqui).

-- 1. Firmas huerfanas: se archivan y se agrega la FK que faltaba (cascade al borrar la ficha).
create table if not exists public.firma_solicitud_huerfanas_20261002 as
  select f.* from public.firma_solicitud f
  where not exists (select 1 from public.form_run r where r.id = f.run_id);
alter table public.firma_solicitud_huerfanas_20261002 enable row level security;
revoke all on public.firma_solicitud_huerfanas_20261002 from anon, authenticated, public;
delete from public.firma_solicitud f where not exists (select 1 from public.form_run r where r.id = f.run_id);
alter table public.firma_solicitud
  add constraint firma_solicitud_run_id_fkey foreign key (run_id) references public.form_run(id) on delete cascade;

-- 2. FK de rol que estaba NOT VALID.
alter table public.profiles validate constraint profiles_role_fkey;

-- 3. Claves unicas naturales.
create unique index if not exists form_template_version_template_version_uidx on public.form_template_version (template_id, version);
create unique index if not exists monitoreo_catalog_anio_codigo_uidx on public.monitoreo_catalog (anio, codigo);
create unique index if not exists monitoreo_ie_asignacion_natural_uidx on public.monitoreo_ie_asignacion (monitoreo_id, institucion_id, user_id);

-- 4. Documento valido.
alter table public.profiles add constraint profiles_documento_valido_chk
  check (tipo_documento in ('DNI','CE') and (tipo_documento <> 'DNI' or numero_documento ~ '^[0-9]{8}$'));

-- 5. Auditoria de tablas de seguridad (sin firma_solicitud: contiene el token publico).
drop trigger if exists audit_changes on public.profiles;
create trigger audit_changes after insert or update or delete on public.profiles
  for each row execute function public.capture_audit_event();
drop trigger if exists audit_changes on public.monitoreo_asignacion;
create trigger audit_changes after insert or update or delete on public.monitoreo_asignacion
  for each row execute function public.capture_audit_event();
drop trigger if exists audit_changes on public.role_module_permission;
create trigger audit_changes after insert or update or delete on public.role_module_permission
  for each row execute function public.capture_audit_event();

-- 6. form_run.updated_at ahora se actualiza en cada UPDATE (lo usa la comparacion de borrador local).
create or replace function public.touch_form_run_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists zz_touch_form_run_updated_at on public.form_run;
create trigger zz_touch_form_run_updated_at before update on public.form_run
  for each row execute function public.touch_form_run_updated_at();

-- 7. El trigger que limpia must_change_password al cambiar la clave existia como funcion pero NO
-- estaba creado sobre auth.users: un usuario nuevo quedaba en bucle en /setup-password.
drop trigger if exists clear_initial_password_change_on_auth_update on auth.users;
create trigger clear_initial_password_change_on_auth_update
after update of encrypted_password on auth.users
for each row execute function public.clear_initial_password_change_on_auth_update();
