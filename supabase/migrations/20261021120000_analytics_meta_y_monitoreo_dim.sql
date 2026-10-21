-- Metas de fichas por especialista (grano: monitoreo x especialista), legible por Power BI.
-- No depende de auth.uid(): vista del owner, acceso solo para powerbi_reader y service_role.
-- subidas = guardadas (draft) + finalizadas (final). El estado tecnico 'borrador' no cuenta.
-- Aplicada en produccion como "analytics_meta_y_monitoreo_dim" (2026-10-21).
create or replace view public.analytics_meta_fact as
select
  a.monitoreo_id,
  c.codigo as monitoreo_code,
  c.nombre as monitoreo_name,
  c.fecha_inicio,
  c.fecha_fin,
  a.user_id as monitor_id,
  trim(both from concat_ws(' ', p.apellido_paterno, p.apellido_materno, p.nombres)) as monitor_name,
  a.meta_fichas,
  count(r.run_id) filter (where r.status in ('draft', 'final')) as subidas,
  count(r.run_id) filter (where r.status = 'final') as finalizadas,
  count(r.run_id) filter (where r.status = 'draft') as guardadas,
  greatest(count(r.run_id) filter (where r.status in ('draft', 'final')) - a.meta_fichas, 0) as excedentes,
  max(r.registered_at) as ultima_ficha_at
from public.monitoreo_asignacion a
join public.monitoreo_catalog c on c.id = a.monitoreo_id and c.is_test = false
join public.profiles p on p.id = a.user_id
left join public.analytics_run_fact r on r.monitoreo_id = a.monitoreo_id and r.monitor_id = a.user_id
where a.meta_fichas is not null
group by a.monitoreo_id, c.codigo, c.nombre, c.fecha_inicio, c.fecha_fin, a.user_id,
         p.apellido_paterno, p.apellido_materno, p.nombres, a.meta_fichas;

-- Dimension de monitoreos con su plazo (para ritmo requerido y dias restantes).
create or replace view public.analytics_monitoreo_dim as
select c.id as monitoreo_id, c.codigo as monitoreo_code, c.nombre as monitoreo_name,
       c.anio, c.fecha_inicio, c.fecha_fin, c.is_active
from public.monitoreo_catalog c
where c.is_test = false;

revoke all on public.analytics_meta_fact, public.analytics_monitoreo_dim from public, anon, authenticated;
grant select on public.analytics_meta_fact, public.analytics_monitoreo_dim to powerbi_reader, service_role;
