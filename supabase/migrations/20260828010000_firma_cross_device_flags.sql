-- RPC en lote para pintar en rojo, directo en la lista de Reportes y
-- Resultados, los registros donde docente y monitor firmaron desde el
-- mismo celular (device_id). Antes solo se veia al abrir el modal
-- "Firmas" de cada fila una por una.
create or replace function public.firma_cross_device_flags(p_run_ids uuid[])
returns uuid[]
language sql
security definer
set search_path = public
set statement_timeout = '5s'
as $$
  with visible_runs as (
    select fr.id as run_id
    from public.form_run fr
    where fr.id = any(p_run_ids)
      and (public.is_admin_user(auth.uid()) or fr.created_by = auth.uid())
  ),
  latest_signed as (
    select distinct on (run_id, signer) run_id, signer, device_id
    from public.firma_solicitud
    where status = 'firmado' and run_id in (select run_id from visible_runs)
    order by run_id, signer, signed_at desc
  ),
  agg as (
    select run_id,
      count(distinct signer) as signer_count,
      count(distinct device_id) as device_count,
      bool_or(device_id is null) as has_null
    from latest_signed
    group by run_id
  )
  select coalesce(array_agg(run_id), array[]::uuid[])
  from agg
  where signer_count = 2 and device_count = 1 and not has_null;
$$;

revoke all on function public.firma_cross_device_flags(uuid[]) from public, anon;
grant execute on function public.firma_cross_device_flags(uuid[]) to authenticated;
