-- Firma digital por QR (docente/monitor) sobre un form_run ya guardado.
-- Introduce la PRIMERA excepcion deliberada de "cero anon" en este proyecto:
-- firma_solicitud_info(uuid) se otorga a anon a proposito, porque el enlace
-- del QR lo abre un docente/monitor en su celular sin haber iniciado sesion.
-- No hay ninguna otra concesion a anon: la escritura de la firma la hace
-- exclusivamente la Edge Function submit-firma-signature con service_role.

alter table public.form_run
  add column if not exists docente_firma_path text,
  add column if not exists monitor_firma_path text;

create table if not exists public.firma_solicitud (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.form_run(id) on delete cascade,
  signer text not null check (signer in ('docente', 'monitor')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pendiente' check (status in ('pendiente', 'firmado', 'expirado')),
  signature_path text,
  expires_at timestamptz not null default (now() + interval '14 days'),
  signed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists firma_solicitud_run_idx on public.firma_solicitud (run_id);

alter table public.firma_solicitud enable row level security;
-- Deny-all directo: sin policies. El acceso pasa unicamente por las
-- funciones security definer de abajo (y por la Edge Function con
-- service_role, que bypassa RLS).
revoke all on public.firma_solicitud from anon, authenticated;

create or replace function public.create_firma_solicitud(p_run_id uuid, p_signer text)
returns uuid
language plpgsql
security definer
set search_path = public
set statement_timeout = '5s'
as $$
declare
  v_owner uuid;
  v_existing uuid;
  v_token uuid;
begin
  if p_signer not in ('docente', 'monitor') then
    raise exception 'signer invalido';
  end if;

  select created_by into v_owner from public.form_run where id = p_run_id;
  if v_owner is null then
    raise exception 'registro no encontrado';
  end if;
  if not public.is_admin_user(auth.uid()) and v_owner <> auth.uid() then
    raise exception 'no autorizado';
  end if;

  select token into v_existing
  from public.firma_solicitud
  where run_id = p_run_id and signer = p_signer and status = 'pendiente' and expires_at > now()
  order by created_at desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.firma_solicitud (run_id, signer, created_by)
  values (p_run_id, p_signer, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.create_firma_solicitud(uuid, text) from public, anon;
grant execute on function public.create_firma_solicitud(uuid, text) to authenticated;

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
  v_institucion := coalesce(v_run.header_json ->> 'institucion_nombre', v_run.header_json ->> 'institucion', '');

  return jsonb_build_object(
    'status', v_row.status,
    'signer', v_row.signer,
    'ficha_titulo', coalesce(v_tpl_titulo, ''),
    'institucion', v_institucion
  );
end;
$$;

revoke all on function public.firma_solicitud_info(uuid) from public;
grant execute on function public.firma_solicitud_info(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('monitoreo-firmas', 'monitoreo-firmas', false, 2097152, array['image/png'])
on conflict (id) do nothing;

drop policy if exists firmas_objects_read on storage.objects;
create policy firmas_objects_read on storage.objects for select to authenticated
using (
  bucket_id = 'monitoreo-firmas'
  and (
    public.is_admin_user(auth.uid())
    or exists (
      select 1 from public.form_run fr
      where fr.id::text = (storage.foldername(name))[1]
        and fr.created_by = auth.uid()
    )
  )
);
-- Sin policy de insert/update/delete: solo la Edge Function (service_role,
-- que bypassa RLS) escribe en este bucket.
