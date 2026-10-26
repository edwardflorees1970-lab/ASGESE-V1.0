-- Revierte 20261026120000: la columna citext en analytics_fichas_pbi hacia fallar en Power BI
-- (DirectQuery) los visuales que consultan la tabla Fichas. Se deja la vista como estaba.
-- La extension citext queda instalada (no se usa).
drop view public.analytics_fichas_pbi;
create view public.analytics_fichas_pbi as
select
  run_id, registered_at, status, monitor_id, monitor_name, monitor_role,
  monitoreo_id, monitoreo_code, monitoreo_name, template_id, template_code, template_name,
  institucion_id, institucion_name, codigo_modular, codigo_local, rei, nivel, distrito,
  ((registered_at at time zone 'America/Lima'))::date as fecha_lima,
  (extract(hour from (registered_at at time zone 'America/Lima')))::integer as hora_lima,
  case
    when exists (select 1 from public.institucion_educativa i where i.rei = f.rei) then rei
    else 'Sin REI'::text
  end as rei_catalogo
from public.analytics_run_fact f;
revoke all on public.analytics_fichas_pbi from public, anon, authenticated;
grant select on public.analytics_fichas_pbi to powerbi_reader, service_role;
alter role powerbi_reader reset search_path;
