begin;

-- Amplía la bitácora creada para exportaciones para registrar también el
-- consentimiento previo a visualizar el módulo de reportes analíticos.
alter table if exists public.data_export_consent
  drop constraint if exists data_export_consent_export_kind_check;

alter table if exists public.data_export_consent
  add constraint data_export_consent_export_kind_check
  check (export_kind in ('view', 'csv', 'xlsx', 'pdf'));

create or replace function public.record_data_export_consent(
  p_export_kind text,
  p_resource text,
  p_policy_version text,
  p_context jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida' using errcode = '42501';
  end if;
  if p_export_kind not in ('view', 'csv', 'xlsx', 'pdf') then
    raise exception 'Tipo de consentimiento invalido';
  end if;
  if length(trim(coalesce(p_resource, ''))) = 0 or length(p_resource) > 120 then
    raise exception 'Recurso de consentimiento invalido';
  end if;
  if length(trim(coalesce(p_policy_version, ''))) = 0 or length(p_policy_version) > 80 then
    raise exception 'Version de aviso invalida';
  end if;
  if pg_column_size(coalesce(p_context, '{}'::jsonb)) > 8192 then
    raise exception 'Contexto de consentimiento demasiado grande';
  end if;

  insert into public.data_export_consent (user_id, export_kind, resource, policy_version, context)
  values (auth.uid(), p_export_kind, trim(p_resource), trim(p_policy_version), coalesce(p_context, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_data_export_consent(text, text, text, jsonb) from public, anon;
grant execute on function public.record_data_export_consent(text, text, text, jsonb) to authenticated;

commit;
