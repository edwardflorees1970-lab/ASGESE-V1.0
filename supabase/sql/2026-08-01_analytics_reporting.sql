-- Modulo de reportes analiticos.
-- Requiere las tablas base del proyecto y debe ejecutarse despues de
-- 2026-07-31_professional_hardening.sql.
-- Power BI puede continuar usando el pooler; el frontend consume solo estas RPC
-- mediante la sesion autenticada y las politicas RLS existentes.

alter table public.form_run
  add column if not exists institucion_id uuid null references public.institucion_educativa(id),
  add column if not exists monitoreo_id uuid null references public.monitoreo_catalog(id);

create index if not exists form_run_analytics_dimensions_idx
  on public.form_run (is_test, status, created_at, monitoreo_id, template_id, created_by);
create index if not exists form_run_institucion_idx
  on public.form_run (institucion_id) where institucion_id is not null;
create index if not exists institucion_educativa_codigo_local_idx
  on public.institucion_educativa (codigo_local) where codigo_local is not null;
create index if not exists ficha_catalog_template_reporting_idx
  on public.ficha_catalog (form_template_id, is_active, monitoreo_id);
create index if not exists form_question_template_reporting_idx
  on public.form_question (template_id, orden, orden_in_section);
create index if not exists form_answer_question_reporting_idx
  on public.form_answer (question_id, run_id);

create or replace function public.resolve_form_run_dimensions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo_modular text := nullif(trim(new.header_json ->> 'codigo_modular'), '');
  v_codigo_local text := nullif(trim(new.header_json ->> 'codigo_local'), '');
begin
  if new.institucion_id is null
     or (tg_op = 'UPDATE' and new.header_json is distinct from old.header_json) then
    select ie.id into new.institucion_id
    from public.institucion_educativa ie
    where (v_codigo_modular is not null and ie.codigo_modular = v_codigo_modular)
       or (v_codigo_modular is null and v_codigo_local is not null and ie.codigo_local = v_codigo_local)
    order by (ie.codigo_modular = v_codigo_modular) desc nulls last
    limit 1;
  end if;

  if new.monitoreo_id is null
     or (tg_op = 'UPDATE' and new.template_id is distinct from old.template_id) then
    select fc.monitoreo_id into new.monitoreo_id
    from public.ficha_catalog fc
    join public.monitoreo_catalog mc on mc.id = fc.monitoreo_id
    where fc.form_template_id = new.template_id
    order by fc.is_active desc, mc.is_active desc, fc.updated_at desc
    limit 1;
  end if;
  return new;
end;
$$;
revoke all on function public.resolve_form_run_dimensions() from public, anon, authenticated;

drop trigger if exists resolve_dimensions on public.form_run;
drop trigger if exists resolve_dimensions_on_insert on public.form_run;
drop trigger if exists resolve_dimensions_on_update on public.form_run;

create trigger resolve_dimensions_on_insert
before insert on public.form_run
for each row execute function public.resolve_form_run_dimensions();

create trigger resolve_dimensions_on_update
before update of template_id, header_json, institucion_id, monitoreo_id on public.form_run
for each row execute function public.resolve_form_run_dimensions();

-- Completa dimensiones historicas sin sobrescribir relaciones ya confirmadas.
update public.form_run run
set institucion_id = (
  select ie.id as institucion_id
  from public.institucion_educativa ie
  where ie.codigo_modular = nullif(trim(run.header_json ->> 'codigo_modular'), '')
     or (
       nullif(trim(run.header_json ->> 'codigo_modular'), '') is null
       and ie.codigo_local = nullif(trim(run.header_json ->> 'codigo_local'), '')
     )
  order by (ie.codigo_modular = nullif(trim(run.header_json ->> 'codigo_modular'), '')) desc nulls last
  limit 1
)
where run.institucion_id is null;

update public.form_run run
set monitoreo_id = (
  select fc.monitoreo_id
  from public.ficha_catalog fc
  join public.monitoreo_catalog mc on mc.id = fc.monitoreo_id
  where fc.form_template_id = run.template_id
  order by fc.is_active desc, mc.is_active desc, fc.updated_at desc
  limit 1
)
where run.monitoreo_id is null;

create or replace view public.analytics_run_fact
with (security_invoker = true)
as
select
  run.id as run_id,
  run.created_at as registered_at,
  run.status,
  run.created_by as monitor_id,
  trim(concat_ws(' ', profile.apellido_paterno, profile.apellido_materno, profile.nombres)) as monitor_name,
  profile.role as monitor_role,
  run.monitoreo_id,
  monitoring.codigo as monitoreo_code,
  monitoring.nombre as monitoreo_name,
  run.template_id,
  template.codigo as template_code,
  template.titulo as template_name,
  run.institucion_id,
  coalesce(institution.nombre, run.header_json ->> 'institucion', 'Sin institucion vinculada') as institucion_name,
  coalesce(institution.codigo_modular, run.header_json ->> 'codigo_modular') as codigo_modular,
  coalesce(institution.codigo_local, run.header_json ->> 'codigo_local') as codigo_local,
  coalesce(institution.rei, run.header_json ->> 'rei', 'Sin REI') as rei,
  coalesce(level.nombre, run.header_json ->> 'nivel', 'Sin nivel') as nivel,
  coalesce(district.nombre, run.header_json ->> 'distrito', 'Sin distrito') as distrito
from public.form_run run
join public.form_template template on template.id = run.template_id
left join public.profiles profile on profile.id = run.created_by
left join public.monitoreo_catalog monitoring on monitoring.id = run.monitoreo_id
left join public.institucion_educativa institution on institution.id = run.institucion_id
left join public.cat_nivel level on level.id = institution.nivel_id
left join public.cat_distrito district on district.id = institution.distrito_id
where run.is_test = false;

revoke all on public.analytics_run_fact from public, anon;
grant select on public.analytics_run_fact to authenticated;

create or replace function public.analytics_filtered_runs(p_filters jsonb default '{}'::jsonb)
returns setof public.analytics_run_fact
language sql
stable
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
  select fact.*
  from public.analytics_run_fact fact
  where fact.status <> 'borrador'
    and (nullif(p_filters ->> 'year', '') is null or extract(year from fact.registered_at)::int = (p_filters ->> 'year')::int)
    and (nullif(p_filters ->> 'month', '') is null or extract(month from fact.registered_at)::int = (p_filters ->> 'month')::int)
    and (nullif(p_filters ->> 'date_from', '') is null or fact.registered_at >= (p_filters ->> 'date_from')::date)
    and (nullif(p_filters ->> 'date_to', '') is null or fact.registered_at < ((p_filters ->> 'date_to')::date + 1))
    and (nullif(p_filters ->> 'monitoreo_id', '') is null or fact.monitoreo_id = (p_filters ->> 'monitoreo_id')::uuid)
    and (nullif(p_filters ->> 'template_id', '') is null or fact.template_id = (p_filters ->> 'template_id')::uuid)
    and (nullif(p_filters ->> 'monitor_id', '') is null or fact.monitor_id = (p_filters ->> 'monitor_id')::uuid)
    and (nullif(p_filters ->> 'institucion_id', '') is null or fact.institucion_id = (p_filters ->> 'institucion_id')::uuid)
    and (nullif(p_filters ->> 'rei', '') is null or fact.rei = p_filters ->> 'rei')
    and (nullif(p_filters ->> 'nivel', '') is null or fact.nivel = p_filters ->> 'nivel')
    and (nullif(p_filters ->> 'distrito', '') is null or fact.distrito = p_filters ->> 'distrito')
    and (nullif(p_filters ->> 'status', '') is null or fact.status = p_filters ->> 'status');
$$;
revoke all on function public.analytics_filtered_runs(jsonb) from public, anon;
grant execute on function public.analytics_filtered_runs(jsonb) to authenticated;

create or replace view public.analytics_answer_fact
with (security_invoker = true)
as
select
  answer.id as answer_id,
  run.run_id,
  run.registered_at,
  run.status,
  run.monitor_id,
  run.monitor_name,
  run.monitoreo_id,
  run.monitoreo_code,
  run.monitoreo_name,
  run.template_id,
  run.template_code,
  run.template_name,
  run.institucion_id,
  run.institucion_name,
  run.rei,
  run.nivel,
  run.distrito,
  question.id as question_id,
  question.texto as question_text,
  question.tipo as question_type,
  coalesce(question.orden_in_section, question.orden) as question_order,
  response.response_axis,
  response.response_value,
  case
    when question.tipo = 'numero' and response.response_value ~ '^-?[0-9]+([.,][0-9]+)?$'
      then replace(response.response_value, ',', '.')::numeric
    else null
  end as numeric_value,
  case
    when jsonb_typeof(question.config_json -> 'reporting' -> 'favorable_values') = 'array'
      then (question.config_json -> 'reporting' -> 'favorable_values') ? response.response_value
    else null
  end as is_favorable
from public.analytics_run_fact run
join public.form_answer answer on answer.run_id = run.run_id
join public.form_question question on question.id = answer.question_id
cross join lateral (
  select 'respuesta'::text as response_axis, nullif(trim(answer.value_json ->> 'yn'), '') as response_value
  where question.tipo in ('yes_no', 'yes_no_nivel')
  union all
  select 'nivel', nullif(trim(answer.value_json ->> 'nivel'), '')
  where question.tipo = 'yes_no_nivel' and nullif(trim(answer.value_json ->> 'nivel'), '') is not null
  union all
  select 'opcion', nullif(trim(answer.value_json ->> 'option'), '')
  where question.tipo = 'opciones'
    and coalesce((question.config_json ->> 'multi')::boolean, false) = false
  union all
  select 'opcion', nullif(trim(option_value), '')
  from jsonb_array_elements_text(coalesce(answer.value_json -> 'options', '[]'::jsonb)) as option_rows(option_value)
  where question.tipo = 'opciones'
    and coalesce((question.config_json ->> 'multi')::boolean, false) = true
  union all
  select 'valor', nullif(trim(answer.value_json ->> 'number'), '')
  where question.tipo = 'numero'
  union all
  select 'texto', nullif(trim(answer.value_json ->> 'text'), '')
  where question.tipo = 'texto'
  union all
  select 'evidencia', case when nullif(trim(answer.value_json ->> 'fileName'), '') is null then null else 'CON_EVIDENCIA' end
  where question.tipo = 'archivo_pdf'
) response
where response.response_value is not null;

revoke all on public.analytics_answer_fact from public, anon;
grant select on public.analytics_answer_fact to authenticated;

create or replace function public.report_filter_options(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
with runs as materialized (
  select * from public.analytics_filtered_runs(p_filters - 'template_id' - 'monitor_id' - 'institucion_id' - 'rei' - 'nivel' - 'distrito' - 'status')
), question_runs as materialized (
  select * from public.analytics_filtered_runs(p_filters - 'question_id' - 'response')
)
select jsonb_build_object(
  'years', coalesce((select jsonb_agg(item order by (item ->> 'value') desc) from (
    select distinct jsonb_build_object('value', extract(year from registered_at)::int::text, 'label', extract(year from registered_at)::int::text) item from runs
  ) values_set), '[]'::jsonb),
  'monitorings', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', monitoreo_id::text, 'label', coalesce(monitoreo_name, 'Sin monitoreo')) item from runs where monitoreo_id is not null
  ) values_set), '[]'::jsonb),
  'templates', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', template_id::text, 'label', template_name) item from runs
  ) values_set), '[]'::jsonb),
  'monitors', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', monitor_id::text, 'label', coalesce(nullif(monitor_name, ''), 'Monitor sin nombre')) item from runs
  ) values_set), '[]'::jsonb),
  'institutions', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', institucion_id::text, 'label', institucion_name) item from runs where institucion_id is not null
  ) values_set), '[]'::jsonb),
  'reis', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', rei, 'label', rei) item from runs where rei is not null
  ) values_set), '[]'::jsonb),
  'levels', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', nivel, 'label', nivel) item from runs where nivel is not null
  ) values_set), '[]'::jsonb),
  'districts', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', distrito, 'label', distrito) item from runs where distrito is not null
  ) values_set), '[]'::jsonb),
  'questions', coalesce((select jsonb_agg(item order by sort_order, item ->> 'label') from (
    select distinct q.id::text as question_key, coalesce(q.orden_in_section, q.orden) sort_order,
      jsonb_build_object('value', q.id::text, 'label', q.texto, 'type', q.tipo) item
    from public.form_question q
    where q.tipo <> 'texto'
      and exists (select 1 from question_runs r where r.template_id = q.template_id)
  ) values_set), '[]'::jsonb),
  'responses', coalesce((select jsonb_agg(item order by item ->> 'label') from (
    select distinct jsonb_build_object('value', answer.response_value, 'label', answer.response_value) item
    from public.analytics_answer_fact answer
    where nullif(p_filters ->> 'question_id','') is not null
      and answer.response_axis <> 'texto'
      and exists (select 1 from question_runs r where r.run_id = answer.run_id)
      and answer.question_id = (p_filters ->> 'question_id')::uuid
  ) values_set), '[]'::jsonb)
);
$$;
revoke all on function public.report_filter_options(jsonb) from public, anon;
grant execute on function public.report_filter_options(jsonb) to authenticated;

create or replace function public.report_executive_summary(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
with runs as materialized (select * from public.analytics_filtered_runs(p_filters)),
groups as (
  select 'monitor'::text dimension, coalesce(nullif(monitor_name, ''), 'Monitor sin nombre') label, count(*)::bigint value from runs group by 2
  union all select 'rei', coalesce(rei, 'Sin REI'), count(*) from runs group by 2
  union all select 'district', coalesce(distrito, 'Sin distrito'), count(*) from runs group by 2
  union all select 'month', to_char(registered_at, 'YYYY-MM'), count(*) from runs group by 2
  union all select 'status', status, count(*) from runs group by 2
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
  'by_monitor', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label) from groups where dimension='monitor'), '[]'::jsonb),
  'by_rei', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from groups where dimension='rei'), '[]'::jsonb),
  'by_district', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label) from groups where dimension='district'), '[]'::jsonb),
  'by_month', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from groups where dimension='month'), '[]'::jsonb),
  'by_status', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from groups where dimension='status'), '[]'::jsonb)
);
$$;
revoke all on function public.report_executive_summary(jsonb) from public, anon;
grant execute on function public.report_executive_summary(jsonb) to authenticated;

create or replace function public.report_monitor_detail(
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
with runs as materialized (select * from public.analytics_filtered_runs(p_filters)),
monitor_level as (
  select coalesce(nullif(monitor_name,''),'Monitor sin nombre') monitor, nivel, count(*)::bigint value from runs group by 1,2
),
rei_level as (
  select rei, nivel, count(*)::bigint value from runs group by 1,2
),
monitor_month as (
  select coalesce(nullif(monitor_name,''),'Monitor sin nombre') monitor, to_char(registered_at,'YYYY-MM') period, count(*)::bigint value from runs group by 1,2
),
monitor_day as (
  select coalesce(nullif(monitor_name,''),'Monitor sin nombre') monitor, to_char(registered_at,'YYYY-MM-DD') period, count(*)::bigint value from runs group by 1,2
)
select jsonb_build_object(
  'kpis', jsonb_build_object(
    'total_runs', (select count(*) from runs),
    'monitor_count', (select count(distinct monitor_id) from runs),
    'institution_count', (select count(distinct institucion_id) from runs where institucion_id is not null)
  ),
  'monitor_level', coalesce((select jsonb_agg(to_jsonb(x) order by x.monitor, x.nivel) from monitor_level x), '[]'::jsonb),
  'rei_level', coalesce((select jsonb_agg(to_jsonb(x) order by x.rei, x.nivel) from rei_level x), '[]'::jsonb),
  'monitor_month', coalesce((select jsonb_agg(to_jsonb(x) order by x.period, x.monitor) from monitor_month x), '[]'::jsonb),
  'monitor_day', coalesce((select jsonb_agg(to_jsonb(x) order by x.period, x.monitor) from monitor_day x), '[]'::jsonb),
  'total_rows', (select count(*) from runs),
  'rows', coalesce((select jsonb_agg(to_jsonb(detail) order by detail.registered_at desc) from (
    select run_id, registered_at, status, monitor_name, monitoreo_name, template_name,
      institucion_name, codigo_modular, codigo_local, rei, nivel, distrito
    from runs order by registered_at desc
    limit least(greatest(p_limit,1),500) offset greatest(p_offset,0)
  ) detail), '[]'::jsonb)
);
$$;
revoke all on function public.report_monitor_detail(jsonb,integer,integer) from public, anon;
grant execute on function public.report_monitor_detail(jsonb,integer,integer) to authenticated;

create or replace function public.report_question_results(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
with runs as materialized (select * from public.analytics_filtered_runs(p_filters)),
answers as materialized (
  select fact.*
  from public.analytics_answer_fact fact
  join runs on runs.run_id = fact.run_id
  where (nullif(p_filters ->> 'question_id','') is null or fact.question_id = (p_filters ->> 'question_id')::uuid)
    and (nullif(p_filters ->> 'response','') is null or fact.response_value = p_filters ->> 'response')
    and fact.response_axis <> 'texto'
),
distribution as (
  select question_id, question_text, question_type, question_order, response_axis, response_value,
    count(distinct answer_id)::bigint value
  from answers
  group by question_id, question_text, question_type, question_order, response_axis, response_value
),
distribution_totals as (
  select question_id, response_axis, count(distinct answer_id)::bigint total from answers group by 1,2
),
dimension_answers as (
  select 'institution'::text dimension, institucion_name label, response_axis, response_value, answer_id from answers where response_axis in ('respuesta','nivel','opcion')
  union all select 'rei', rei, response_axis, response_value, answer_id from answers where response_axis in ('respuesta','nivel','opcion')
  union all select 'district', distrito, response_axis, response_value, answer_id from answers where response_axis in ('respuesta','nivel','opcion')
  union all select 'level', nivel, response_axis, response_value, answer_id from answers where response_axis in ('respuesta','nivel','opcion')
),
dimension_values as (
  select dimension, label, response_axis, response_value, count(distinct answer_id)::bigint value
  from dimension_answers group by 1,2,3,4
),
dimension_totals as (
  select dimension, label, response_axis, count(distinct answer_id)::numeric total
  from dimension_answers group by 1,2,3
)
select jsonb_build_object(
  'kpis', jsonb_build_object(
    'run_count', (select count(*) from runs),
    'question_count', (select count(distinct question_id) from answers),
    'answer_count', (select count(distinct answer_id) from answers)
  ),
  'questions', coalesce((select jsonb_agg(jsonb_build_object(
    'question_id', base.question_id,
    'question_text', base.question_text,
    'question_type', base.question_type,
    'question_order', base.question_order,
    'axis', base.response_axis,
    'total', totals.total,
    'distribution', (
      select jsonb_agg(jsonb_build_object(
        'label', item.response_value,
        'value', item.value,
        'percentage', round(item.value * 100.0 / nullif(totals.total,0), 2)
      ) order by item.response_value)
      from distribution item
      where item.question_id=base.question_id and item.response_axis=base.response_axis
    )
  ) order by base.question_order, base.response_axis) from (
    select distinct question_id, question_text, question_type, question_order, response_axis from distribution
  ) base join distribution_totals totals using(question_id,response_axis)), '[]'::jsonb),
  'by_institution', coalesce((select jsonb_agg(jsonb_build_object('label',v.label,'axis',v.response_axis,'response',v.response_value,'value',v.value,'percentage',round(v.value*100.0/nullif(t.total,0),2)) order by v.label,v.response_axis,v.response_value) from dimension_values v join dimension_totals t using(dimension,label,response_axis) where v.dimension='institution'), '[]'::jsonb),
  'by_rei', coalesce((select jsonb_agg(jsonb_build_object('label',v.label,'axis',v.response_axis,'response',v.response_value,'value',v.value,'percentage',round(v.value*100.0/nullif(t.total,0),2)) order by v.label,v.response_axis,v.response_value) from dimension_values v join dimension_totals t using(dimension,label,response_axis) where v.dimension='rei'), '[]'::jsonb),
  'by_district', coalesce((select jsonb_agg(jsonb_build_object('label',v.label,'axis',v.response_axis,'response',v.response_value,'value',v.value,'percentage',round(v.value*100.0/nullif(t.total,0),2)) order by v.label,v.response_axis,v.response_value) from dimension_values v join dimension_totals t using(dimension,label,response_axis) where v.dimension='district'), '[]'::jsonb),
  'by_level', coalesce((select jsonb_agg(jsonb_build_object('label',v.label,'axis',v.response_axis,'response',v.response_value,'value',v.value,'percentage',round(v.value*100.0/nullif(t.total,0),2)) order by v.label,v.response_axis,v.response_value) from dimension_values v join dimension_totals t using(dimension,label,response_axis) where v.dimension='level'), '[]'::jsonb)
);
$$;
revoke all on function public.report_question_results(jsonb) from public, anon;
grant execute on function public.report_question_results(jsonb) to authenticated;
