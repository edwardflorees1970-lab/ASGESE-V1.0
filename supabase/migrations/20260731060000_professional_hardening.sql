-- Endurecimiento profesional: auditoria, transacciones, versiones inmutables,
-- evidencias privadas, telemetria y agregaciones de dashboard.
-- Aplicar antes de desplegar el frontend que consume estas RPC.

create table if not exists public.audit_event (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid null,
  actor_role text null,
  action text not null,
  entity_schema text not null,
  entity_table text not null,
  entity_id text null,
  before_data jsonb null,
  after_data jsonb null,
  request_id text null
);

create index if not exists audit_event_occurred_at_idx on public.audit_event (occurred_at desc);
create index if not exists audit_event_entity_idx on public.audit_event (entity_table, entity_id, occurred_at desc);
alter table public.audit_event enable row level security;
revoke insert, update, delete on public.audit_event from anon, authenticated;
grant select on public.audit_event to authenticated;

drop policy if exists audit_event_read_privileged on public.audit_event;
create policy audit_event_read_privileged on public.audit_event
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'jefe_area', 'director')
  )
);

create or replace function public.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
begin
  insert into public.audit_event (
    actor_id, actor_role, action, entity_schema, entity_table, entity_id,
    before_data, after_data, request_id
  )
  values (
    auth.uid(),
    (select p.role from public.profiles p where p.id = auth.uid()),
    tg_op, tg_table_schema, tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    v_old, v_new, v_headers ->> 'x-request-id'
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.capture_audit_event() from public, anon, authenticated;

-- La tabla existente no declara unicidad por respuesta. No se eliminan datos
-- automaticamente: si existen duplicados se detiene la migracion para que sean
-- revisados antes de crear el indice requerido por el UPSERT atomico.
do $$
begin
  if exists (
    select 1
    from public.form_answer
    group by run_id, question_id
    having count(*) > 1
  ) then
    raise exception
      'Existen respuestas duplicadas en form_answer. Revise los pares (run_id, question_id) antes de reintentar la migracion.'
      using errcode = '23505';
  end if;
end
$$;

create unique index if not exists form_answer_run_question_uidx
  on public.form_answer (run_id, question_id);

create index if not exists form_run_dashboard_idx
  on public.form_run (is_test, created_at, template_id, status);
create index if not exists form_run_duplicate_local_idx
  on public.form_run (template_id, is_test, upper(trim(header_json ->> 'codigo_local')))
  where status in ('draft', 'final');
create index if not exists form_run_duplicate_modular_idx
  on public.form_run (template_id, is_test, upper(trim(header_json ->> 'codigo_modular')))
  where status in ('draft', 'final');

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'monitoreo_solicitud', 'monitoreo_catalog', 'ficha_catalog',
    'form_template', 'form_section', 'form_question', 'form_run', 'form_answer'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists audit_changes on public.%I', v_table);
      execute format(
        'create trigger audit_changes after insert or update or delete on public.%I '
        'for each row execute function public.capture_audit_event()',
        v_table
      );
    end if;
  end loop;
end
$$;

create table if not exists public.form_template_version (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.form_template(id),
  version integer not null check (version > 0),
  snapshot jsonb not null,
  published_by uuid not null default auth.uid() references auth.users(id),
  published_at timestamptz not null default now(),
  unique (template_id, version)
);
create index if not exists form_template_version_lookup_idx
  on public.form_template_version (template_id, version desc);
alter table public.form_template_version enable row level security;
grant select on public.form_template_version to authenticated;
revoke insert, update, delete on public.form_template_version from anon, authenticated;

create or replace function public.can_read_form_template(p_template_id uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and (
    public.can_manage_template(p_template_id, p_uid)
    or exists (
      select 1
      from public.ficha_catalog f
      join public.monitoreo_catalog m on m.id = f.monitoreo_id
      where f.form_template_id = p_template_id
        and f.is_active = true
        and m.is_active = true
    )
  );
$$;
revoke all on function public.can_read_form_template(uuid, uuid) from public, anon;
grant execute on function public.can_read_form_template(uuid, uuid) to authenticated;

drop policy if exists form_template_version_read on public.form_template_version;
create policy form_template_version_read on public.form_template_version
for select to authenticated using (public.can_read_form_template(template_id));

alter table public.form_run
  add column if not exists template_version_id uuid null references public.form_template_version(id);

create or replace function public.reject_immutable_change()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Las versiones publicadas son inmutables' using errcode = '55000';
end;
$$;
revoke all on function public.reject_immutable_change() from public, anon, authenticated;
drop trigger if exists form_template_version_immutable on public.form_template_version;
create trigger form_template_version_immutable
before update or delete on public.form_template_version
for each row execute function public.reject_immutable_change();

create or replace function public.publish_form_template_version(p_template_id uuid)
returns public.form_template_version
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
  v_snapshot jsonb;
  v_result public.form_template_version;
begin
  if auth.uid() is null or not public.can_manage_template(p_template_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_template_id::text, 0));
  if not exists (select 1 from public.form_template where id = p_template_id) then
    raise exception 'Plantilla no encontrada' using errcode = 'P0002';
  end if;
  select coalesce(max(version), 0) + 1 into v_version
  from public.form_template_version where template_id = p_template_id;
  select jsonb_build_object(
    'template', to_jsonb(t),
    'sections', coalesce((select jsonb_agg(to_jsonb(s) order by s.orden) from public.form_section s where s.template_id = t.id), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.orden) from public.form_question q where q.template_id = t.id), '[]'::jsonb)
  ) into v_snapshot
  from public.form_template t where t.id = p_template_id;
  insert into public.form_template_version(template_id, version, snapshot, published_by)
  values (p_template_id, v_version, v_snapshot, auth.uid()) returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.publish_form_template_version(uuid) from public, anon;
grant execute on function public.publish_form_template_version(uuid) to authenticated;

create or replace function public.can_manage_form_run(p_run_id uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.form_run r
    where r.id = p_run_id
      and (
        r.created_by = p_uid
        or exists (select 1 from public.profiles p where p.id = p_uid and p.role in ('admin', 'jefe_area', 'director'))
      )
  );
$$;
revoke all on function public.can_manage_form_run(uuid, uuid) from public, anon;
grant execute on function public.can_manage_form_run(uuid, uuid) to authenticated;

create or replace function public.save_form_run_atomic(
  p_run_id uuid,
  p_template_id uuid,
  p_status text,
  p_is_test boolean,
  p_header jsonb,
  p_footer jsonb,
  p_answers jsonb,
  p_duplicate_field text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid := p_run_id;
  v_version_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sesion requerida' using errcode = '42501'; end if;
  if p_status not in ('borrador', 'draft', 'final') then raise exception 'Estado invalido'; end if;
  if not public.can_read_form_template(p_template_id) then raise exception 'Plantilla no accesible' using errcode = '42501'; end if;
  if p_duplicate_field is not null and p_duplicate_field not in ('codigo_local', 'codigo_modular') then
    raise exception 'Regla de duplicidad invalida';
  end if;
  if v_run_id is null and p_status = 'draft' then
    select r.id into v_run_id from public.form_run r
    where r.template_id = p_template_id and r.created_by = auth.uid()
      and r.status = 'borrador' and r.is_test = p_is_test
    order by r.created_at desc limit 1 for update;
  end if;
  if v_run_id is not null and not public.can_manage_form_run(v_run_id) then
    raise exception 'No autorizado para modificar el registro' using errcode = '42501';
  end if;
  if p_duplicate_field is not null and p_status = 'draft' then
    v_code := upper(trim(coalesce(p_header ->> p_duplicate_field, '')));
    if v_code = '' then raise exception 'Falta codigo para validar duplicados'; end if;
    if exists (
      select 1 from public.form_run r
      where r.template_id = p_template_id and r.is_test = p_is_test
        and r.status in ('draft', 'final') and r.id is distinct from v_run_id
        and upper(trim(coalesce(r.header_json ->> p_duplicate_field, ''))) = v_code
    ) then raise exception 'Ya existe una ficha con el mismo codigo' using errcode = '23505'; end if;
  end if;
  select id into v_version_id from public.form_template_version
  where template_id = p_template_id order by version desc limit 1;
  if v_run_id is null then
    insert into public.form_run(template_id, template_version_id, created_by, status, is_test, header_json, footer_json)
    values (p_template_id, v_version_id, auth.uid(), p_status, p_is_test, coalesce(p_header, '{}'::jsonb), coalesce(p_footer, '{}'::jsonb))
    returning id into v_run_id;
  else
    update public.form_run set
      template_id = p_template_id,
      template_version_id = coalesce(template_version_id, v_version_id),
      status = p_status, is_test = p_is_test,
      header_json = coalesce(p_header, '{}'::jsonb), footer_json = coalesce(p_footer, '{}'::jsonb)
    where id = v_run_id;
  end if;
  delete from public.form_answer a where a.run_id = v_run_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x
      where (x ->> 'question_id')::uuid = a.question_id
    );
  insert into public.form_answer(run_id, question_id, value_json)
  select v_run_id, (x ->> 'question_id')::uuid, coalesce(x -> 'value_json', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x
  on conflict (run_id, question_id) do update set value_json = excluded.value_json;
  return v_run_id;
end;
$$;
revoke all on function public.save_form_run_atomic(uuid, uuid, text, boolean, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.save_form_run_atomic(uuid, uuid, text, boolean, jsonb, jsonb, jsonb, text) to authenticated;

create or replace function public.delete_form_run_atomic(p_run_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_manage_form_run(p_run_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  delete from public.form_answer where run_id = p_run_id;
  delete from public.form_run where id = p_run_id;
  return found;
end;
$$;
revoke all on function public.delete_form_run_atomic(uuid) from public, anon;
grant execute on function public.delete_form_run_atomic(uuid) to authenticated;

create or replace function public.publish_monitoreo_solicitud_atomic(p_solicitud_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sol public.monitoreo_solicitud;
  v_mon_id uuid;
  v_codigo text := 'SOL-' || upper(substr(p_solicitud_id::text, 1, 8));
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Solo administracion puede publicar' using errcode = '42501';
  end if;
  select * into v_sol from public.monitoreo_solicitud where id = p_solicitud_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode = 'P0002'; end if;
  if v_sol.status not in ('approved_lv1', 'approved') then raise exception 'La solicitud requiere aprobacion de nivel 1'; end if;
  update public.monitoreo_solicitud set status='approved', approved_by=auth.uid(), approved_at=now()
  where id=p_solicitud_id;
  select id into v_mon_id from public.monitoreo_catalog
  where solicitud_id=p_solicitud_id or codigo=v_codigo order by (solicitud_id=p_solicitud_id) desc limit 1 for update;
  if v_mon_id is null then
    insert into public.monitoreo_catalog(anio,codigo,nombre,descripcion,is_active,fecha_inicio,fecha_fin,solicitud_id)
    values (extract(year from v_sol.fecha_inicio)::int,v_codigo,v_sol.nombre,v_sol.detalle,true,v_sol.fecha_inicio,v_sol.fecha_fin,p_solicitud_id)
    returning id into v_mon_id;
  else
    update public.monitoreo_catalog set solicitud_id=p_solicitud_id, nombre=v_sol.nombre,
      descripcion=v_sol.detalle, fecha_inicio=v_sol.fecha_inicio, fecha_fin=v_sol.fecha_fin, is_active=true
    where id=v_mon_id;
  end if;
  insert into public.ficha_catalog(monitoreo_id,codigo,titulo,version,orden,is_active,form_template_id)
  select v_mon_id,t.codigo,t.titulo,1,coalesce(t.orden,1),true,t.id
  from public.form_template t where t.solicitud_id=p_solicitud_id
    and not exists (select 1 from public.ficha_catalog f where f.monitoreo_id=v_mon_id and f.form_template_id=t.id);
  if not exists (select 1 from public.monitoreo_solicitud_ie where solicitud_id=p_solicitud_id)
     and to_regprocedure('public.populate_solicitud_ie(uuid)') is not null then
    execute 'select public.populate_solicitud_ie($1)' using p_solicitud_id;
  end if;
  return v_mon_id;
end;
$$;
revoke all on function public.publish_monitoreo_solicitud_atomic(uuid) from public, anon;
grant execute on function public.publish_monitoreo_solicitud_atomic(uuid) to authenticated;

create table if not exists public.form_answer_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.form_run(id) on delete cascade,
  question_id uuid not null references public.form_question(id),
  object_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (run_id, question_id)
);
alter table public.form_answer_evidence enable row level security;
grant select, insert, update, delete on public.form_answer_evidence to authenticated;
drop policy if exists evidence_read on public.form_answer_evidence;
create policy evidence_read on public.form_answer_evidence for select to authenticated
using (public.can_manage_form_run(run_id));
drop policy if exists evidence_write on public.form_answer_evidence;
create policy evidence_write on public.form_answer_evidence for insert to authenticated
with check (uploaded_by=auth.uid() and public.can_manage_form_run(run_id));
drop policy if exists evidence_update on public.form_answer_evidence;
create policy evidence_update on public.form_answer_evidence for update to authenticated
using (uploaded_by=auth.uid() and public.can_manage_form_run(run_id))
with check (uploaded_by=auth.uid() and public.can_manage_form_run(run_id));
drop policy if exists evidence_delete on public.form_answer_evidence;
create policy evidence_delete on public.form_answer_evidence for delete to authenticated
using (public.can_manage_form_run(run_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('monitoring-evidence','monitoring-evidence',false,5242880,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists evidence_objects_read on storage.objects;
create policy evidence_objects_read on storage.objects for select to authenticated
using (bucket_id='monitoring-evidence' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin_user(auth.uid())));
drop policy if exists evidence_objects_insert on storage.objects;
create policy evidence_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='monitoring-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists evidence_objects_update on storage.objects;
create policy evidence_objects_update on storage.objects for update to authenticated
using (bucket_id='monitoring-evidence' and owner_id=auth.uid()::text)
with check (bucket_id='monitoring-evidence' and owner_id=auth.uid()::text);
drop policy if exists evidence_objects_delete on storage.objects;
create policy evidence_objects_delete on storage.objects for delete to authenticated
using (bucket_id='monitoring-evidence' and (owner_id=auth.uid()::text or public.is_admin_user(auth.uid())));

create table if not exists public.app_telemetry_event (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid null default auth.uid(),
  severity text not null check (severity in ('info','warning','error','fatal')),
  event_type text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  request_id text null
);
create index if not exists app_telemetry_recent_idx on public.app_telemetry_event(occurred_at desc, severity);
alter table public.app_telemetry_event enable row level security;
grant insert, select on public.app_telemetry_event to authenticated;
revoke update, delete on public.app_telemetry_event from anon, authenticated;
drop policy if exists telemetry_insert_own on public.app_telemetry_event;
create policy telemetry_insert_own on public.app_telemetry_event for insert to authenticated
with check (user_id=auth.uid() and length(message)<=1000 and pg_column_size(context)<=16384);
drop policy if exists telemetry_read_privileged on public.app_telemetry_event;
create policy telemetry_read_privileged on public.app_telemetry_event for select to authenticated
using (public.is_admin_user(auth.uid()));

create or replace function public.notify_telemetry_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.severity in ('error', 'fatal') then
    perform pg_notify('app_telemetry_alert', jsonb_build_object(
      'id', new.id, 'severity', new.severity, 'event_type', new.event_type,
      'occurred_at', new.occurred_at
    )::text);
  end if;
  return new;
end;
$$;
revoke all on function public.notify_telemetry_alert() from public, anon, authenticated;
drop trigger if exists telemetry_alert_notify on public.app_telemetry_event;
create trigger telemetry_alert_notify after insert on public.app_telemetry_event
for each row execute function public.notify_telemetry_alert();

create or replace function public.dashboard_run_facts(
  p_from timestamptz, p_to timestamptz, p_is_test boolean, p_template_ids uuid[] default null
)
returns table(id text,status text,created_by uuid,created_at timestamptz,template_id uuid,run_count bigint)
language sql stable security invoker set search_path = public as $$
  select min(r.id::text), r.status, r.created_by, date_trunc('day',r.created_at), r.template_id, count(*)
  from public.form_run r
  where r.created_at>=p_from and r.created_at<p_to and r.is_test=p_is_test and r.status<>'borrador'
    and (p_template_ids is null or r.template_id=any(p_template_ids))
  group by r.status,r.created_by,date_trunc('day',r.created_at),r.template_id;
$$;
revoke all on function public.dashboard_run_facts(timestamptz,timestamptz,boolean,uuid[]) from public, anon;
grant execute on function public.dashboard_run_facts(timestamptz,timestamptz,boolean,uuid[]) to authenticated;

-- Auditoria de las nuevas entidades despues de crearlas.
drop trigger if exists audit_changes on public.form_template_version;
create trigger audit_changes after insert or update or delete on public.form_template_version
for each row execute function public.capture_audit_event();
drop trigger if exists audit_changes on public.form_answer_evidence;
create trigger audit_changes after insert or update or delete on public.form_answer_evidence
for each row execute function public.capture_audit_event();
