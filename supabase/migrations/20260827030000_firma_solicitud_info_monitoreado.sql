-- firma_solicitud_info() mostraba el codigo modular crudo ("167") como
-- "institucion" porque header_json no siempre trae un nombre legible.
-- Se agrega el nombre del monitoreado (mas util para que el firmante
-- confirme que es el enlace correcto) sin cambiar los grants existentes.

create or replace function public.firma_solicitud_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '5s'
as $$
declare
  v_row public.firma_solicitud%rowtype;
  v_run public.form_run%rowtype;
  v_tpl_titulo text;
  v_institucion text;
  v_monitoreado text;
begin
  select * into v_row from public.firma_solicitud where token = p_token;
  if v_row.id is null then
    return jsonb_build_object('status', 'invalido');
  end if;

  if v_row.status = 'pendiente' and v_row.expires_at <= now() then
    update public.firma_solicitud set status = 'expirado' where id = v_row.id;
    v_row.status := 'expirado';
  end if;

  select * into v_run from public.form_run where id = v_row.run_id;
  select titulo into v_tpl_titulo from public.form_template where id = v_run.template_id;
  v_institucion := coalesce(nullif(v_run.header_json ->> 'institucion_nombre', ''), nullif(v_run.header_json ->> 'institucion', ''), '');
  v_monitoreado := coalesce(nullif(v_run.header_json ->> 'monitoreado', ''), '');

  return jsonb_build_object(
    'status', v_row.status,
    'signer', v_row.signer,
    'ficha_titulo', coalesce(v_tpl_titulo, ''),
    'institucion', v_institucion,
    'monitoreado', v_monitoreado
  );
end;
$$;
