-- by_monitor / by_rei / by_district en report_executive_summary pasan de un
-- solo contador ("value") a desagregar finalizada vs en_proceso, y ahora
-- incluyen las etiquetas en cero (monitores asignados sin fichas, REI y
-- distritos del catalogo sin actividad). Antes, un monitor/REI/distrito sin
-- ninguna ficha registrada simplemente no aparecia en la barra -- la
-- ausencia de actividad, que suele ser la senal mas urgente para prevenir y
-- actuar, era invisible.
--
-- El universo de monitores solo se completa con ceros cuando el reporte
-- esta filtrado a un monitoreo especifico (via monitoreo_asignacion); sin
-- ese filtro no hay un universo de monitores bien definido. REI y distrito
-- si tienen un catalogo estable (institucion_educativa) y se completan
-- siempre.

create or replace function public.report_executive_summary(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
with runs as materialized (select * from public.analytics_filtered_runs(p_filters)),
status_groups as (
  select 'monitor'::text dimension, coalesce(nullif(monitor_name, ''), 'Monitor sin nombre') label, status, count(*)::bigint value from runs group by 2, 3
  union all select 'rei', coalesce(rei, 'Sin REI'), status, count(*) from runs group by 2, 3
  union all select 'district', coalesce(distrito, 'Sin distrito'), status, count(*) from runs group by 2, 3
),
month_groups as (
  select to_char(registered_at, 'YYYY-MM') label, count(*)::bigint value from runs group by 1
),
status_totals as (
  select status label, count(*)::bigint value from runs group by 1
),
monitor_universe as (
  select distinct coalesce(nullif(trim(concat_ws(' ', p.apellido_paterno, p.apellido_materno, p.nombres)), ''), 'Monitor sin nombre') as label
  from public.monitoreo_asignacion ma
  join public.profiles p on p.id = ma.user_id
  where nullif(p_filters ->> 'monitoreo_id', '') is not null
    and ma.monitoreo_id = (p_filters ->> 'monitoreo_id')::uuid
),
rei_universe as (
  select distinct rei as label from public.institucion_educativa where nullif(trim(rei), '') is not null
),
district_universe as (
  select distinct d.nombre as label
  from public.institucion_educativa ie
  join public.cat_distrito d on d.id = ie.distrito_id
  where nullif(trim(d.nombre), '') is not null
),
monitor_labels as (
  select label from status_groups where dimension = 'monitor'
  union select label from monitor_universe
),
rei_labels as (
  select label from status_groups where dimension = 'rei'
  union select label from rei_universe
),
district_labels as (
  select label from status_groups where dimension = 'district'
  union select label from district_universe
),
monitor_agg as (
  select l.label,
    coalesce(sum(g.value) filter (where g.status = 'final'), 0)::bigint finalizada,
    coalesce(sum(g.value) filter (where g.status = 'draft'), 0)::bigint en_proceso
  from monitor_labels l
  left join status_groups g on g.dimension = 'monitor' and g.label = l.label
  group by l.label
),
rei_agg as (
  select l.label,
    coalesce(sum(g.value) filter (where g.status = 'final'), 0)::bigint finalizada,
    coalesce(sum(g.value) filter (where g.status = 'draft'), 0)::bigint en_proceso
  from rei_labels l
  left join status_groups g on g.dimension = 'rei' and g.label = l.label
  group by l.label
),
district_agg as (
  select l.label,
    coalesce(sum(g.value) filter (where g.status = 'final'), 0)::bigint finalizada,
    coalesce(sum(g.value) filter (where g.status = 'draft'), 0)::bigint en_proceso
  from district_labels l
  left join status_groups g on g.dimension = 'district' and g.label = l.label
  group by l.label
)
select jsonb_build_object(
  'kpis', jsonb_build_object(
    'total_runs', (select count(*) from runs),
    'finalized_runs', (select count(*) from runs where status = 'final'),
    'draft_runs', (select count(*) from runs where status = 'draft'),
    'monitor_count', (select count(distinct monitor_id) from runs),
    'institution_count', (select count(distinct institucion_id) from runs where institucion_id is not null),
    'unlinked_institution_count', (select count(*) from runs where institucion_id is null)
  ),
  'by_monitor', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'finalizada', finalizada, 'en_proceso', en_proceso, 'value', finalizada + en_proceso) order by (finalizada + en_proceso) desc, label) from monitor_agg), '[]'::jsonb),
  'by_rei', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'finalizada', finalizada, 'en_proceso', en_proceso, 'value', finalizada + en_proceso) order by label) from rei_agg), '[]'::jsonb),
  'by_district', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'finalizada', finalizada, 'en_proceso', en_proceso, 'value', finalizada + en_proceso) order by (finalizada + en_proceso) desc, label) from district_agg), '[]'::jsonb),
  'by_month', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from month_groups), '[]'::jsonb),
  'by_status', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from status_totals), '[]'::jsonb)
);
$$;
revoke all on function public.report_executive_summary(jsonb) from public, anon;
grant execute on function public.report_executive_summary(jsonb) to authenticated;
