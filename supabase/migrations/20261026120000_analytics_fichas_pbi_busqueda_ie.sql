-- Power BI (DirectQuery) envia la busqueda de los filtros a PostgreSQL, que distingue mayusculas.
-- Se agrega al final de la vista una copia del nombre de la IE como citext: LIKE/strpos sobre
-- citext no distinguen mayusculas, asi que el buscador del filtro encuentra "santa" o "SANTA".
-- La columna institucion_name original no cambia.

create extension if not exists citext with schema extensions;

create or replace view public.analytics_fichas_pbi as
select
  run_id,
  registered_at,
  status,
  monitor_id,
  monitor_name,
  monitor_role,
  monitoreo_id,
  monitoreo_code,
  monitoreo_name,
  template_id,
  template_code,
  template_name,
  institucion_id,
  institucion_name,
  codigo_modular,
  codigo_local,
  rei,
  nivel,
  distrito,
  ((registered_at at time zone 'America/Lima'))::date as fecha_lima,
  (extract(hour from (registered_at at time zone 'America/Lima')))::integer as hora_lima,
  case
    when exists (select 1 from public.institucion_educativa i where i.rei = f.rei) then rei
    else 'Sin REI'::text
  end as rei_catalogo,
  institucion_name::extensions.citext as institucion_buscar
from public.analytics_run_fact f;

-- Los operadores de citext viven en el esquema extensions: el lector de Power BI necesita verlos
-- en su search_path; si no, LIKE caeria al operador de text (que si distingue mayusculas).
grant usage on schema extensions to powerbi_reader;
alter role powerbi_reader set search_path = "$user", public, extensions;
