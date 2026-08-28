-- El cruce de "mismo IP" da falsos positivos: docente y monitor suelen
-- firmar desde la MISMA red WiFi del colegio (eso es normal, no fraude).
-- Lo que importa es si es el MISMO CELULAR, no la misma red. Se agrega un
-- device_id aleatorio guardado en localStorage del navegador que firma;
-- si ambas firmas de un mismo registro traen el mismo device_id, es una
-- senal mucho mas confiable de que una sola persona firmo por las dos.
alter table public.firma_solicitud
  add column if not exists device_id text;

create or replace function public.list_firma_solicitudes(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '5s'
as $$
declare
  v_owner uuid;
begin
  select created_by into v_owner from public.form_run where id = p_run_id;
  if v_owner is null then
    raise exception 'registro no encontrado';
  end if;
  if not public.is_admin_user(auth.uid()) and v_owner <> auth.uid() then
    raise exception 'no autorizado';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'signer', signer,
      'status', status,
      'signed_at', signed_at,
      'foto_path', foto_path,
      'signer_ip', signer_ip,
      'signer_user_agent', signer_user_agent,
      'device_id', device_id
    ) order by created_at desc)
    from public.firma_solicitud
    where run_id = p_run_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_firma_solicitudes(uuid) from public, anon;
grant execute on function public.list_firma_solicitudes(uuid) to authenticated;
