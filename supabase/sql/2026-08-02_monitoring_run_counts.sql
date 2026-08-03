-- Conteo eficiente de fichas registradas por monitoreo para el selector.
-- SECURITY INVOKER conserva las políticas RLS de form_run para el usuario actual.
create or replace function public.monitoring_registered_run_counts(
  p_monitoreo_ids uuid[],
  p_is_test boolean
)
returns table (
  monitoreo_id uuid,
  run_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.monitoreo_id, count(*) as run_count
  from public.form_run r
  where r.monitoreo_id = any(p_monitoreo_ids)
    and r.is_test = p_is_test
    and r.status <> 'borrador'
  group by r.monitoreo_id;
$$;

revoke all on function public.monitoring_registered_run_counts(uuid[], boolean) from public;
grant execute on function public.monitoring_registered_run_counts(uuid[], boolean) to authenticated;

create or replace function public.monitoring_cdd_registered_run_count(
  p_monitoreo_ids uuid[],
  p_is_test boolean
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)
  from public.form_run r
  join public.profiles p on p.id = r.created_by
  where r.monitoreo_id = any(p_monitoreo_ids)
    and r.is_test = p_is_test
    and r.status <> 'borrador'
    and p.role = 'responsable_cdd';
$$;

revoke all on function public.monitoring_cdd_registered_run_count(uuid[], boolean) from public;
grant execute on function public.monitoring_cdd_registered_run_count(uuid[], boolean) to authenticated;
