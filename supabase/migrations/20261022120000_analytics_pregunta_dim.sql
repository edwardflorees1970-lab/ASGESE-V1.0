-- Dimension de preguntas para Power BI: seccion y numero dentro de la seccion (igual que la ficha).
-- Aplicada en produccion como "analytics_pregunta_dim" (2026-10-22).
create or replace view public.analytics_pregunta_dim as
select
  q.id as question_id,
  q.template_id,
  s.titulo as seccion,
  s.orden as seccion_orden,
  q.orden_in_section as nro_en_seccion,
  q.texto as pregunta,
  q.tipo
from public.form_question q
left join public.form_section s on s.id = q.section_id;

revoke all on public.analytics_pregunta_dim from public, anon, authenticated;
grant select on public.analytics_pregunta_dim to powerbi_reader, service_role;
