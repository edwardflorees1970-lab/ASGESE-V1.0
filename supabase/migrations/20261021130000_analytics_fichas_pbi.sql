-- Vista para Power BI: analytics_run_fact + fecha y hora de Lima. No modifica analytics_run_fact
-- (la usa analytics_filtered_runs y el modulo de reportes de la app).
-- Aplicada en produccion como "analytics_fichas_pbi" (2026-10-21).
create or replace view public.analytics_fichas_pbi as
select
  f.*,
  (f.registered_at at time zone 'America/Lima')::date as fecha_lima,
  extract(hour from (f.registered_at at time zone 'America/Lima'))::int as hora_lima
from public.analytics_run_fact f;

revoke all on public.analytics_fichas_pbi from public, anon, authenticated;
grant select on public.analytics_fichas_pbi to powerbi_reader, service_role;
