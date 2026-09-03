-- monitoreo_solicitud_ie mezclaba en una sola lista las IE que entran
-- por los filtros del monitoreo (Gestion/Modalidad/Nivel, poblado por
-- populate_solicitud_ie) con las IE agregadas a mano para una meta CdD.
-- El panel "Instituciones (seleccion manual)" del constructor cargaba y
-- guardaba TODA la tabla como si fuera manual (para un monitoreo real
-- llego a mostrar 469 chips), y su boton "Guardar" borraba todo y
-- reinsertaba solo lo que quedaba en pantalla -- riesgo real de borrar
-- el filtro completo del monitoreo por accidente.
alter table public.monitoreo_solicitud_ie
  add column if not exists origen text not null default 'filtro' check (origen in ('filtro', 'manual'));

-- Todo lo ya existente vino de populate_solicitud_ie o de la insercion
-- en submitSolicitud (ambas eran, hasta ahora, la unica via) -- se
-- marca como filtro por default arriba; no hay forma de distinguir
-- retroactivamente cuales fueron realmente manuales, asi que se dejan
-- todas como 'filtro' (el admin puede re-agregar manualmente las que
-- necesite marcar para CdD).

create unique index if not exists monitoreo_solicitud_ie_uidx
  on public.monitoreo_solicitud_ie (solicitud_id, institucion_id);

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

  -- Solo reemplaza las filas de origen 'filtro' -- las 'manual' nunca se tocan aqui.
  delete from monitoreo_solicitud_ie where solicitud_id = p_solicitud_id and origen = 'filtro';

  insert into monitoreo_solicitud_ie (solicitud_id, institucion_id, origen)
  select p_solicitud_id, ie.id, 'filtro'
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
    )
  on conflict (solicitud_id, institucion_id) do nothing;
end;
$$;

grant execute on function public.populate_solicitud_ie(uuid) to authenticated;
