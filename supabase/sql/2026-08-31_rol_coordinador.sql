-- Nuevo rol "Coordinador": puede crear/ver monitoreos (via permisos de
-- modulo, configurable en Roles y permisos), aprobar/publicar solicitudes
-- de monitoreo, y resetear contraseñas SOLO de usuarios con rol Monitor
-- ("user"). El reset de contraseña ya se restringio en la Edge Function
-- admin-reset-password; aqui se habilita la aprobacion/publicacion.
insert into public.app_role (code, name, is_active, is_system)
values ('coordinador', 'Coordinador', true, false)
on conflict (code) do nothing;

create or replace function public.publish_monitoreo_solicitud_atomic(p_solicitud_id uuid)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_sol public.monitoreo_solicitud;
  v_mon_id uuid;
  v_codigo text := 'SOL-' || upper(substr(p_solicitud_id::text, 1, 8));
  v_is_test boolean := coalesce((select value::boolean from public.app_config where key = 'modo_test'), false);
  v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if auth.uid() is null or not (public.is_admin_user(auth.uid()) or v_caller_role = 'coordinador') then
    raise exception 'Solo administracion o coordinacion puede publicar' using errcode = '42501';
  end if;
  select * into v_sol from public.monitoreo_solicitud where id = p_solicitud_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode = 'P0002'; end if;
  if v_sol.status not in ('approved_lv1', 'approved') then raise exception 'La solicitud requiere aprobacion de nivel 1'; end if;
  update public.monitoreo_solicitud set status='approved', approved_by=auth.uid(), approved_at=now()
  where id=p_solicitud_id;
  select id into v_mon_id from public.monitoreo_catalog
  where solicitud_id=p_solicitud_id or codigo=v_codigo order by (solicitud_id=p_solicitud_id) desc limit 1 for update;
  if v_mon_id is null then
    insert into public.monitoreo_catalog(anio,codigo,nombre,descripcion,is_active,fecha_inicio,fecha_fin,solicitud_id,is_test)
    values (extract(year from v_sol.fecha_inicio)::int,v_codigo,v_sol.nombre,v_sol.detalle,true,v_sol.fecha_inicio,v_sol.fecha_fin,p_solicitud_id,v_is_test)
    returning id into v_mon_id;
  else
    update public.monitoreo_catalog set solicitud_id=p_solicitud_id, nombre=v_sol.nombre,
      descripcion=v_sol.detalle, fecha_inicio=v_sol.fecha_inicio, fecha_fin=v_sol.fecha_fin, is_active=true
    where id=v_mon_id;
  end if;
  insert into public.ficha_catalog(monitoreo_id,codigo,titulo,version,orden,is_active,form_template_id)
  select v_mon_id,t.codigo,t.titulo,1,coalesce(t.orden,1),true,t.id
  from public.form_template t where t.solicitud_id=p_solicitud_id
    and not exists (select 1 from public.ficha_catalog f where f.monitoreo_id=v_mon_id and f.form_template_id=t.id);
  if not exists (select 1 from public.monitoreo_solicitud_ie where solicitud_id=p_solicitud_id)
     and to_regprocedure('public.populate_solicitud_ie(uuid)') is not null then
    execute 'select public.populate_solicitud_ie($1)' using p_solicitud_id;
  end if;
  return v_mon_id;
end;
$function$;
