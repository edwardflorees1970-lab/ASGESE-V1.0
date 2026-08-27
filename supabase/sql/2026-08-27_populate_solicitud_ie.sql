-- Rebuilds monitoreo_solicitud_ie for a solicitud based on its saved
-- filtros (Gestion / Modalidad / Nivel). Missing before this migration —
-- the "Reaplicar filtros IE" button in the app called this RPC and it
-- never existed on this database.
--
-- "Tipo" (Focalizado / No focalizado) is intentionally NOT used for
-- matching: it doesn't correspond to any static attribute of
-- institucion_educativa. In practice "Focalizado" means a hand-picked
-- list of specific IE for a CdD push, not a filterable property, so it
-- stays informational-only on monitoreo_solicitud_filtro for now.
create or replace function public.populate_solicitud_ie(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gestiones text[];
  v_modalidades text[];
  v_niveles text[];
begin
  select array_agg(distinct gestion) filter (where gestion is not null) into v_gestiones
    from monitoreo_solicitud_filtro where solicitud_id = p_solicitud_id;
  select array_agg(distinct modalidad) filter (where modalidad is not null) into v_modalidades
    from monitoreo_solicitud_filtro where solicitud_id = p_solicitud_id;
  select array_agg(distinct nivel) filter (where nivel is not null) into v_niveles
    from monitoreo_solicitud_filtro where solicitud_id = p_solicitud_id;

  insert into monitoreo_solicitud_ie (solicitud_id, institucion_id)
  select p_solicitud_id, ie.id
  from institucion_educativa ie
  left join cat_modalidad cm on cm.id = ie.modalidad_id
  left join cat_nivel cn on cn.id = ie.nivel_id
  where
    (v_gestiones is null or ie.gestion = any (v_gestiones))
    and (v_modalidades is null or cm.nombre = any (v_modalidades))
    and (
      v_niveles is null
      or exists (
        select 1 from unnest(v_niveles) as n(code)
        where cn.nombre ilike (n.code || '%')
      )
    );
end;
$$;

grant execute on function public.populate_solicitud_ie(uuid) to authenticated;
