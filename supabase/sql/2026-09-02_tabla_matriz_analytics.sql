-- Nuevo tipo de pregunta 'tabla_matriz' (tabla numerica N x M). La vista
-- analytics_answer_fact ya ignora silenciosamente cualquier tipo sin un
-- branch propio en su cross join lateral (el WHERE final descarta filas
-- con response_value null), asi que no requiere cambios: las preguntas
-- tabla_matriz simplemente no emiten filas de analitica en v1 (igual que
-- cualquier tipo desconocido hoy). Lo unico que se ajusta es excluirla de
-- la lista de preguntas "filtrables" en report_filter_options, mismo
-- tratamiento que ya recibe 'texto'.
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
    where q.tipo not in ('texto', 'tabla_matriz')
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
