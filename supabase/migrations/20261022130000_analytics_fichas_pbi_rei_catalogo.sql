-- REI validada contra el catalogo: si la ficha trae una REI que no existe en institucion_educativa
-- (texto libre del encabezado, vacio o un codigo mal escrito) se muestra 'Sin REI'.
-- Aplicada en produccion como "analytics_fichas_pbi_rei_catalogo" (2026-10-22).
create or replace view public.analytics_fichas_pbi as
select
  f.*,
  (f.registered_at at time zone 'America/Lima')::date as fecha_lima,
  extract(hour from (f.registered_at at time zone 'America/Lima'))::int as hora_lima,
  case when exists (select 1 from public.institucion_educativa i where i.rei = f.rei) then f.rei else 'Sin REI' end as rei_catalogo
from public.analytics_run_fact f;
