-- Anti-fraude para firma_solicitud: evita que quien tiene el celular en mano
-- firme "por ambos" (docente y monitor) sin que el docente este realmente
-- presente. Tres capas, todas gratuitas:
--   1) DNI: el firmante debe escribir su propio DNI, validado en servidor
--      contra el footer_json capturado en la ficha (docente_dni/monitor_dni).
--   2) Foto: se exige una foto (camara) al momento de firmar, como evidencia.
--   3) Cruce de dispositivo: se guarda IP + user-agent de quien firma; si
--      docente y monitor de un mismo registro firman desde el mismo
--      dispositivo/IP, queda visible para que un admin lo revise.

alter table public.firma_solicitud
  add column if not exists signer_ip text,
  add column if not exists signer_user_agent text,
  add column if not exists foto_path text,
  add column if not exists dni_confirmado text;

-- Lectura de las solicitudes de un run para el modal de "Firmas" (admin o
-- dueño del registro). No expone el token de otras solicitudes: solo
-- estado/evidencia, nunca el token en si.
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
      'signer_user_agent', signer_user_agent
    ) order by created_at desc)
    from public.firma_solicitud
    where run_id = p_run_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_firma_solicitudes(uuid) from public, anon;
grant execute on function public.list_firma_solicitudes(uuid) to authenticated;
