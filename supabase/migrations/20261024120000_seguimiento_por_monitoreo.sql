-- Seguimiento por monitoreo: ritmo por especialista, pendientes/alertas,
-- cobertura de IE y compromisos post-visita.

-- 1. Compromisos acordados con la IE despues de la visita.
create table if not exists public.monitoreo_compromiso (
  id uuid primary key default gen_random_uuid(),
  monitoreo_id uuid not null references public.monitoreo_catalog(id) on delete cascade,
  institucion_id uuid references public.institucion_educativa(id) on delete set null,
  form_run_id uuid references public.form_run(id) on delete set null,
  descripcion text not null check (char_length(btrim(descripcion)) between 3 and 1000),
  responsable text check (responsable is null or char_length(responsable) <= 200),
  fecha_limite date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cumplido', 'anulado')),
  nota_cierre text check (nota_cierre is null or char_length(nota_cierre) <= 1000),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cerrado_by uuid references public.profiles(id),
  cerrado_at timestamptz
);

create index if not exists monitoreo_compromiso_monitoreo_idx on public.monitoreo_compromiso (monitoreo_id, estado);
create index if not exists monitoreo_compromiso_ie_idx on public.monitoreo_compromiso (institucion_id);
create index if not exists monitoreo_compromiso_run_idx on public.monitoreo_compromiso (form_run_id);

-- Cierre: se registra quien y cuando; al reabrir se limpia.
create or replace function public.monitoreo_compromiso_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.monitoreo_id := old.monitoreo_id;
    if new.estado <> old.estado then
      if new.estado = 'pendiente' then
        new.cerrado_by := null;
        new.cerrado_at := null;
      else
        new.cerrado_by := auth.uid();
        new.cerrado_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists monitoreo_compromiso_touch on public.monitoreo_compromiso;
create trigger monitoreo_compromiso_touch
  before insert or update on public.monitoreo_compromiso
  for each row execute function public.monitoreo_compromiso_touch();

alter table public.monitoreo_compromiso enable row level security;

drop policy if exists compromiso_select on public.monitoreo_compromiso;
create policy compromiso_select on public.monitoreo_compromiso
  for select to authenticated
  using ((select public.can_supervise_all()));

drop policy if exists compromiso_insert on public.monitoreo_compromiso;
create policy compromiso_insert on public.monitoreo_compromiso
  for insert to authenticated
  with check ((select public.can_manage_app_module('seguimiento')) and created_by = (select auth.uid()));

drop policy if exists compromiso_update on public.monitoreo_compromiso;
create policy compromiso_update on public.monitoreo_compromiso
  for update to authenticated
  using ((select public.can_manage_app_module('seguimiento')))
  with check ((select public.can_manage_app_module('seguimiento')));

drop policy if exists compromiso_delete on public.monitoreo_compromiso;
create policy compromiso_delete on public.monitoreo_compromiso
  for delete to authenticated
  using ((select public.is_admin()) or created_by = (select auth.uid()));

revoke all on public.monitoreo_compromiso from anon;
grant select, insert, update, delete on public.monitoreo_compromiso to authenticated;

-- 2. Datos del seguimiento de un monitoreo en una sola llamada.
create or replace function public.seguimiento_monitoreo(p_monitoreo_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not public.can_supervise_all(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with mon as (
    select m.id, m.codigo, m.nombre, m.fecha_inicio, m.fecha_fin
    from public.monitoreo_catalog m
    where m.id = p_monitoreo_id
  ),
  runs as (
    select r.id, r.status, r.created_by, r.created_at, r.updated_at, r.institucion_id,
           r.header_json, t.codigo as template_codigo,
           public.run_is_signed(r.id) as firmado
    from public.form_run r
    left join public.form_template t on t.id = r.template_id
    where r.monitoreo_id = p_monitoreo_id and not r.is_test
  ),
  fichas as (
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'created_by', r.created_by,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'institucion_id', r.institucion_id,
      'ie_nombre', coalesce(ie.nombre, r.header_json->>'institucion'),
      'codigo_modular', coalesce(ie.codigo_modular, r.header_json->>'codigo_modular'),
      'rei', coalesce(nullif(ie.rei, ''), nullif(r.header_json->>'rei', '')),
      'nivel', n.nombre,
      'distrito', r.header_json->>'distrito',
      'fecha_aplicacion', r.header_json->>'fecha_aplicacion',
      'template_codigo', r.template_codigo,
      'firmado', r.firmado
    ) order by r.created_at desc) as data
    from runs r
    left join public.institucion_educativa ie on ie.id = r.institucion_id
    left join public.cat_nivel n on n.id = ie.nivel_id
  ),
  especialistas as (
    select jsonb_agg(jsonb_build_object(
      'user_id', u.user_id,
      'nombre', coalesce(nullif(btrim(concat_ws(' ', p.apellido_paterno, p.apellido_materno, p.nombres)), ''), p.correo, p.email, 'Usuario'),
      'rei', p.rei,
      'meta', u.meta_fichas
    ) order by p.apellido_paterno nulls last) as data
    from (
      select a.user_id, a.meta_fichas
      from public.monitoreo_asignacion a
      where a.monitoreo_id = p_monitoreo_id
      union
      select distinct r.created_by, null::integer
      from runs r
      where not exists (
        select 1 from public.monitoreo_asignacion a
        where a.monitoreo_id = p_monitoreo_id and a.user_id = r.created_by
      )
    ) u
    left join public.profiles p on p.id = u.user_id
  ),
  visitadas as (
    select distinct institucion_id from runs where institucion_id is not null
  ),
  cobertura as (
    select jsonb_agg(jsonb_build_object('rei', c.rei, 'total', c.total, 'visitadas', c.visitadas) order by c.rei) as data
    from (
      select coalesce(nullif(ie.rei, ''), 'Sin REI') as rei,
             count(*) as total,
             count(v.institucion_id) as visitadas
      from public.institucion_educativa ie
      left join visitadas v on v.institucion_id = ie.id
      group by 1
    ) c
  )
  select jsonb_build_object(
    'monitoreo', (select to_jsonb(mon) from mon),
    'especialistas', coalesce((select data from especialistas), '[]'::jsonb),
    'fichas', coalesce((select data from fichas), '[]'::jsonb),
    'cobertura', coalesce((select data from cobertura), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.seguimiento_monitoreo(uuid) from public, anon;
grant execute on function public.seguimiento_monitoreo(uuid) to authenticated;

update public.app_module
set description = 'Ritmo por especialista, pendientes, cobertura de IE y compromisos de cada monitoreo'
where code = 'seguimiento';
