-- Agrupa cambios de una misma transaccion y convierte la telemetria repetida
-- en incidentes administrables, sin perder el detalle forense por fila.

alter table public.audit_event
  add column if not exists operation_id text;

update public.audit_event
set operation_id = coalesce(
  nullif(request_id, ''),
  'legacy-tx:' || md5(coalesce(actor_id::text, 'system') || '|' || occurred_at::text)
)
where operation_id is null;

alter table public.audit_event
  alter column operation_id set not null;

create index if not exists audit_event_operation_idx
  on public.audit_event (operation_id, occurred_at desc);

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
  v_request_id text := nullif(v_headers ->> 'x-request-id', '');
  v_operation_id text;
begin
  -- Los UPSERT pueden ejecutar UPDATE aunque el contenido no cambie. No
  -- generamos ruido de auditoria para esas escrituras idempotentes.
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;

  -- Una RPC puede modificar varias filas. txid_current() mantiene el mismo
  -- identificador para todos los triggers ejecutados en esa transaccion.
  v_operation_id := coalesce(v_request_id, 'tx:' || txid_current()::text);

  insert into public.audit_event (
    actor_id, actor_role, action, entity_schema, entity_table, entity_id,
    before_data, after_data, request_id, operation_id
  )
  values (
    auth.uid(),
    (select p.role from public.profiles p where p.id = auth.uid()),
    tg_op, tg_table_schema, tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    v_old, v_new, v_request_id, v_operation_id
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_audit_event() from public, anon, authenticated;

alter table public.app_telemetry_event
  add column if not exists fingerprint text,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id),
  add column if not exists resolution_note text;

update public.app_telemetry_event
set fingerprint = coalesce(
      fingerprint,
      md5(lower(trim(event_type)) || '|' || trim(message) || '|' || coalesce(context ->> 'source', ''))
    ),
    first_seen_at = coalesce(first_seen_at, occurred_at),
    last_seen_at = coalesce(last_seen_at, occurred_at)
where fingerprint is null or first_seen_at is null or last_seen_at is null;

-- Incidentes de desarrollo ya corregidos y verificados por typecheck/build.
-- Se conservan como historial, pero dejan de figurar como alertas activas.
update public.app_telemetry_event
set resolved_at = coalesce(resolved_at, now()),
    resolution_note = coalesce(resolution_note, 'Incidente historico de desarrollo corregido y verificado.')
where resolved_at is null
  and severity = 'fatal'
  and (
    message = 'CollapseIcon is not defined'
    or message = 'ChartActions is not defined'
    or message = 'options is not iterable'
    or message like 'Attempting to parse an unsupported color function "oklab"%'
    or message like 'Failed to fetch dynamically imported module:%/src/pages/AnalyticsReportsPage.tsx%'
  );

-- Consolida duplicados activos anteriores sin borrar evidencia historica.
with grouped as (
  select fingerprint, max(id) as keeper_id, count(*)::integer as total_occurrences,
         min(first_seen_at) as first_seen, max(last_seen_at) as last_seen
  from public.app_telemetry_event
  where resolved_at is null and fingerprint is not null
  group by fingerprint
)
update public.app_telemetry_event event
set occurrence_count = grouped.total_occurrences,
    first_seen_at = grouped.first_seen,
    last_seen_at = grouped.last_seen
from grouped
where event.id = grouped.keeper_id;

with ranked as (
  select id, row_number() over (partition by fingerprint order by id desc) as position
  from public.app_telemetry_event
  where resolved_at is null and fingerprint is not null
)
update public.app_telemetry_event event
set resolved_at = now(),
    resolution_note = 'Consolidado automaticamente en el incidente activo mas reciente.'
from ranked
where event.id = ranked.id and ranked.position > 1;

create unique index if not exists app_telemetry_active_fingerprint_uidx
  on public.app_telemetry_event (fingerprint)
  where resolved_at is null;

create index if not exists app_telemetry_incident_state_idx
  on public.app_telemetry_event (resolved_at, last_seen_at desc, severity);

create or replace function public.capture_telemetry_event(
  p_event_type text,
  p_message text,
  p_severity text default 'error',
  p_context jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fingerprint text;
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida' using errcode = '42501';
  end if;
  if p_severity not in ('info', 'warning', 'error', 'fatal') then
    raise exception 'Severidad invalida';
  end if;
  if length(coalesce(p_message, '')) = 0 or length(p_message) > 1000 then
    raise exception 'Mensaje de telemetria invalido';
  end if;
  if pg_column_size(coalesce(p_context, '{}'::jsonb)) > 16384 then
    raise exception 'Contexto de telemetria demasiado grande';
  end if;

  v_fingerprint := md5(
    lower(trim(left(p_event_type, 120))) || '|' ||
    trim(left(p_message, 1000)) || '|' ||
    coalesce(p_context ->> 'source', '')
  );

  select event.id into v_id
  from public.app_telemetry_event event
  where event.fingerprint = v_fingerprint and event.resolved_at is null
  for update;

  if v_id is null then
    insert into public.app_telemetry_event (
      user_id, severity, event_type, message, context, fingerprint,
      first_seen_at, last_seen_at, occurrence_count
    )
    values (
      auth.uid(), p_severity, left(p_event_type, 120), left(p_message, 1000),
      coalesce(p_context, '{}'::jsonb), v_fingerprint, now(), now(), 1
    )
    returning id into v_id;
  else
    update public.app_telemetry_event
    set last_seen_at = now(),
        occurrence_count = occurrence_count + 1,
        severity = case
          when severity = 'fatal' or p_severity = 'fatal' then 'fatal'
          when severity = 'error' or p_severity = 'error' then 'error'
          when severity = 'warning' or p_severity = 'warning' then 'warning'
          else 'info'
        end,
        context = coalesce(p_context, '{}'::jsonb),
        user_id = auth.uid()
    where id = v_id;
  end if;

  return v_id;
exception
  when unique_violation then
    update public.app_telemetry_event
    set last_seen_at = now(), occurrence_count = occurrence_count + 1
    where fingerprint = v_fingerprint and resolved_at is null
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.capture_telemetry_event(text, text, text, jsonb) from public, anon;
grant execute on function public.capture_telemetry_event(text, text, text, jsonb) to authenticated;

create or replace function public.resolve_telemetry_event(
  p_event_id bigint,
  p_resolution_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.app_telemetry_event
  set resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_note = nullif(left(trim(coalesce(p_resolution_note, '')), 500), '')
  where id = p_event_id and resolved_at is null;

  return found;
end;
$$;

revoke all on function public.resolve_telemetry_event(bigint, text) from public, anon;
grant execute on function public.resolve_telemetry_event(bigint, text) to authenticated;

-- La escritura directa se reemplaza por la RPC para garantizar deduplicacion.
revoke insert on public.app_telemetry_event from authenticated;
drop policy if exists telemetry_insert_own on public.app_telemetry_event;

create or replace function public.prune_operational_history(
  p_audit_days integer default 365,
  p_resolved_telemetry_days integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_deleted integer := 0;
  v_telemetry_deleted integer := 0;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  delete from public.audit_event
  where occurred_at < now() - make_interval(days => greatest(p_audit_days, 90));
  get diagnostics v_audit_deleted = row_count;

  delete from public.app_telemetry_event
  where resolved_at is not null
    and last_seen_at < now() - make_interval(days => greatest(p_resolved_telemetry_days, 30));
  get diagnostics v_telemetry_deleted = row_count;

  return jsonb_build_object(
    'audit_deleted', v_audit_deleted,
    'telemetry_deleted', v_telemetry_deleted
  );
end;
$$;

revoke all on function public.prune_operational_history(integer, integer) from public, anon;
grant execute on function public.prune_operational_history(integer, integer) to authenticated;
