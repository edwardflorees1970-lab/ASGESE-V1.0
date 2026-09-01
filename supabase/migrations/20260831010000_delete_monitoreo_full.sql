-- El frontend (GestionMonitoreosPage) siempre llamo a esta RPC para
-- borrar un monitoreo completo, pero nunca existio en el servidor -- caia
-- siempre al fallback manual client-side (multiples deletes en orden),
-- que fallaba silenciosamente ante el primer error de RLS sin mostrarlo
-- en el modal ("no hace nada" al usuario). Se crea la funcion real:
-- transaccional, security definer (bypassa RLS), solo admin.
create or replace function public.delete_monitoreo_full(p_monitoreo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set statement_timeout = '20s'
as $$
declare
  v_solicitud_id uuid;
  v_template_ids uuid[];
  v_run_ids uuid[];
  v_question_ids uuid[];
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Solo administracion puede eliminar monitoreos' using errcode = '42501';
  end if;

  -- form_template_version tiene un trigger de inmutabilidad a proposito
  -- (no se puede editar/borrar una version ya publicada). Un borrado
  -- completo de monitoreo es la unica excepcion legitima: se desactivan
  -- los triggers solo dentro de esta transaccion.
  set local session_replication_role = replica;

  select solicitud_id into v_solicitud_id from public.monitoreo_catalog where id = p_monitoreo_id;
  if v_solicitud_id is null then
    -- no habia solicitud vinculada; igual se intenta por si quedo suelta via ficha_catalog
    select array_agg(distinct form_template_id) into v_template_ids
      from public.ficha_catalog where monitoreo_id = p_monitoreo_id and form_template_id is not null;
  else
    select array_agg(id) into v_template_ids from public.form_template where solicitud_id = v_solicitud_id;
  end if;

  if v_template_ids is not null then
    select array_agg(id) into v_run_ids from public.form_run where template_id = any(v_template_ids);
    select array_agg(id) into v_question_ids from public.form_question where template_id = any(v_template_ids);
  end if;

  if v_run_ids is not null then
    delete from public.form_answer where run_id = any(v_run_ids);
    delete from public.form_run where id = any(v_run_ids);
  end if;
  if v_question_ids is not null then
    delete from public.form_answer where question_id = any(v_question_ids);
    delete from public.form_question where id = any(v_question_ids);
  end if;
  if v_template_ids is not null then
    delete from public.form_section where template_id = any(v_template_ids);
  end if;

  delete from public.ficha_catalog where monitoreo_id = p_monitoreo_id;

  if v_template_ids is not null then
    delete from public.form_template_version where template_id = any(v_template_ids);
    delete from public.form_template where id = any(v_template_ids);
  end if;

  delete from public.monitoreo_ie_validacion where monitoreo_id = p_monitoreo_id;
  delete from public.monitoreo_ie_avance where monitoreo_id = p_monitoreo_id;
  delete from public.monitoreo_ie_asignacion where monitoreo_id = p_monitoreo_id;
  delete from public.monitoreo_asignacion where monitoreo_id = p_monitoreo_id;
  delete from public.monitoreo_actividad_extra where monitoreo_id = p_monitoreo_id;
  delete from public.monitoreo_actividad where monitoreo_id = p_monitoreo_id;

  update public.monitoreo_catalog set solicitud_id = null where id = p_monitoreo_id;
  delete from public.monitoreo_catalog where id = p_monitoreo_id;

  if v_solicitud_id is not null then
    delete from public.monitoreo_solicitud_ie where solicitud_id = v_solicitud_id;
    delete from public.monitoreo_solicitud_filtro where solicitud_id = v_solicitud_id;
    delete from public.monitoreo_solicitud where id = v_solicitud_id;
  end if;
end;
$$;

revoke all on function public.delete_monitoreo_full(uuid) from public, anon;
grant execute on function public.delete_monitoreo_full(uuid) to authenticated;
