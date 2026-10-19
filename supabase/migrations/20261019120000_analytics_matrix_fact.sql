-- Una fila por celda con valor de las preguntas tabla_matriz, para analisis (Power BI).
-- Solo lectura: no altera form_answer. Las celdas en blanco no se emiten (= sin dato).
-- Totales escritos a mano (columna "Total" / fila "Total ...") se marcan, no deben sumarse.
-- Aplicada en produccion como "analytics_matrix_fact" (2026-10-19). Verificada: 1182 celdas origen = 1182 en vista.
create or replace view public.analytics_matrix_fact as
select
  r.run_id, r.registered_at, r.status, r.monitor_id, r.monitor_name,
  r.monitoreo_id, r.monitoreo_code, r.monitoreo_name,
  r.institucion_id, r.institucion_name, r.codigo_modular, r.rei, r.nivel, r.distrito,
  q.id as question_id,
  q.texto as tabla_nombre,
  case
    when q.texto ilike '%inicial%' then 'Inicial'
    when q.texto ilike '%primaria%' or q.texto ilike '%prmaria%' then 'Primaria'
    when q.texto ilike '%secundaria%' then 'Secundaria'
    else null
  end as nivel_tabla,
  (rw.ord - 1)::int as fila_idx,
  lab.fila_label as fila,
  (c.ord - 1)::int as col_idx,
  lab.col_label as columna,
  case
    when lab.fila_label ilike 'total%' then null
    when lab.fila_label ilike 'director%' or lab.fila_label ilike 'subdirector%' then 'Directivo'
    when lab.fila_label ilike 'docente%' then 'Docente'
    when lab.fila_label ilike 'auxiliar%' then 'Auxiliar'
    when lab.fila_label ilike 'personal administrativo%' then 'Administrativo'
    else null
  end as cargo,
  case
    when lab.fila_label ilike '%nombrad%' then 'Nombrado'
    when lab.fila_label ilike '%contratad%' then 'Contratado'
    else null
  end as condicion,
  (lab.fila_label ilike 'total%') as es_fila_total,
  (lab.col_label ilike 'total%') as es_columna_total,
  case when btrim(c.val) ~ '^-?[0-9]+(\.[0-9]+)?$' then btrim(c.val)::numeric end as valor,
  not (btrim(c.val) ~ '^[0-9]+(\.[0-9]+)?$') as es_invalido,
  a.updated_at as actualizado_el
from public.form_answer a
join public.form_question q on q.id = a.question_id and q.tipo = 'tabla_matriz'
join public.analytics_run_fact r on r.run_id = a.run_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(a.value_json -> 'matrix') = 'array' then a.value_json -> 'matrix' else '[]'::jsonb end
) with ordinality as rw(row_json, ord)
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(rw.row_json) = 'array' then rw.row_json else '[]'::jsonb end
) with ordinality as c(val, ord)
cross join lateral (
  select q.config_json -> 'rows' ->> ((rw.ord - 1)::int) as fila_label,
         q.config_json -> 'cols' ->> ((c.ord - 1)::int) as col_label
) as lab
where btrim(c.val) <> ''
  and lab.fila_label is not null
  and lab.col_label is not null;

revoke all on public.analytics_matrix_fact from public, anon, authenticated;
grant select on public.analytics_matrix_fact to powerbi_reader, service_role;
