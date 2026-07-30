-- Hardening para warnings de Supabase Database Linter.
--
-- Objetivo:
-- 1) Fijar search_path en funciones existentes para evitar hijacking por schemas.
-- 2) Revocar ejecucion anon/public de funciones SECURITY DEFINER.
-- 3) Mantener permisos authenticated solo donde la app/RLS lo necesita.
--
-- Nota:
-- Algunos warnings authenticated_security_definer_function_executable pueden
-- permanecer en funciones RPC usadas por la app o helpers usados por RLS. Quitarlos
-- sin mover esos flujos a Edge Functions/private schema podria romper funcionalidad.

do $$
declare
  fn record;
  harden_names text[] := array[
    'asignar_ie_automatico_rei',
    'can_create_monitoreo',
    'can_manage_monitoreo',
    'can_manage_solicitud',
    'can_manage_template',
    'can_manage_tracking',
    'cleanup_edge_rate_limits',
    'delete_monitoreo_full',
    'enforce_edge_rate_limit',
    'handle_new_user',
    'is_admin',
    'is_admin_or_supervisor',
    'is_admin_user',
    'is_jefe_or_director',
    'is_responsable_cdd',
    'is_supervisor_safe',
    'populate_solicitud_ie',
    'set_updated_at',
    'user_can_manage_solicitud',
    'user_can_manage_template',
    'user_can_read_template'
  ];
begin
  for fn in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (harden_names)
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      fn.nspname,
      fn.proname,
      fn.args
    );

    execute format(
      'revoke all on function %I.%I(%s) from public',
      fn.nspname,
      fn.proname,
      fn.args
    );

    execute format(
      'revoke all on function %I.%I(%s) from anon',
      fn.nspname,
      fn.proname,
      fn.args
    );
  end loop;
end
$$;

-- RPCs y helpers que la app/RLS necesitan desde usuarios autenticados.
-- Se protegen con to_regprocedure para que el script no falle si una firma
-- cambia entre ambientes.
do $$
begin
  if to_regprocedure('public.populate_solicitud_ie(uuid)') is not null then
    grant execute on function public.populate_solicitud_ie(uuid) to authenticated;
  end if;

  if to_regprocedure('public.delete_monitoreo_full(uuid)') is not null then
    grant execute on function public.delete_monitoreo_full(uuid) to authenticated;
  end if;

  if to_regprocedure('public.asignar_ie_automatico_rei(uuid)') is not null then
    grant execute on function public.asignar_ie_automatico_rei(uuid) to authenticated;
  end if;

  if to_regprocedure('public.can_create_monitoreo()') is not null then
    grant execute on function public.can_create_monitoreo() to authenticated;
  end if;

  if to_regprocedure('public.can_manage_monitoreo(uuid, uuid)') is not null then
    grant execute on function public.can_manage_monitoreo(uuid, uuid) to authenticated;
  end if;

  if to_regprocedure('public.can_manage_solicitud(uuid, uuid)') is not null then
    grant execute on function public.can_manage_solicitud(uuid, uuid) to authenticated;
  end if;

  if to_regprocedure('public.can_manage_template(uuid, uuid)') is not null then
    grant execute on function public.can_manage_template(uuid, uuid) to authenticated;
  end if;

  if to_regprocedure('public.can_manage_tracking(uuid)') is not null then
    grant execute on function public.can_manage_tracking(uuid) to authenticated;
  elsif to_regprocedure('public.can_manage_tracking()') is not null then
    grant execute on function public.can_manage_tracking() to authenticated;
  end if;

  if to_regprocedure('public.is_admin()') is not null then
    grant execute on function public.is_admin() to authenticated;
  end if;

  if to_regprocedure('public.is_admin(uuid)') is not null then
    grant execute on function public.is_admin(uuid) to authenticated;
  end if;

  if to_regprocedure('public.is_admin_or_supervisor()') is not null then
    grant execute on function public.is_admin_or_supervisor() to authenticated;
  end if;

  if to_regprocedure('public.is_admin_user(uuid)') is not null then
    grant execute on function public.is_admin_user(uuid) to authenticated;
  end if;

  if to_regprocedure('public.is_jefe_or_director()') is not null then
    grant execute on function public.is_jefe_or_director() to authenticated;
  end if;

  if to_regprocedure('public.is_responsable_cdd(uuid)') is not null then
    grant execute on function public.is_responsable_cdd(uuid) to authenticated;
  end if;

  if to_regprocedure('public.is_supervisor_safe()') is not null then
    grant execute on function public.is_supervisor_safe() to authenticated;
  end if;

  if to_regprocedure('public.user_can_manage_solicitud(uuid)') is not null then
    grant execute on function public.user_can_manage_solicitud(uuid) to authenticated;
  end if;

  if to_regprocedure('public.user_can_manage_template(uuid)') is not null then
    grant execute on function public.user_can_manage_template(uuid) to authenticated;
  end if;

  if to_regprocedure('public.user_can_read_template(uuid)') is not null then
    grant execute on function public.user_can_read_template(uuid) to authenticated;
  end if;
end
$$;

-- Funciones internas: no deben ser ejecutables por clientes autenticados.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    revoke all on function public.set_updated_at() from authenticated;
  end if;

  if to_regprocedure('public.handle_new_user()') is not null then
    revoke all on function public.handle_new_user() from authenticated;
  end if;

  if to_regprocedure('public.cleanup_edge_rate_limits(interval)') is not null then
    revoke all on function public.cleanup_edge_rate_limits(interval) from authenticated;
    grant execute on function public.cleanup_edge_rate_limits(interval) to service_role;
  end if;

  if to_regprocedure('public.enforce_edge_rate_limit(text, integer, integer)') is not null then
    revoke all on function public.enforce_edge_rate_limit(text, integer, integer) from authenticated;
    grant execute on function public.enforce_edge_rate_limit(text, integer, integer) to service_role;
  end if;
end
$$;
