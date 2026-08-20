-- Plazas de Director IIEE por colegio publico y modalidad.
-- La cuenta Auth solo se crea cuando una carga ocupa una plaza vacante.

create table if not exists public.director_iiee_plaza (
  id uuid primary key default gen_random_uuid(),
  codigo_institucional text not null check (codigo_institucional ~ '^[0-9]{8}$'),
  institucion_nombre text not null,
  modalidad text not null check (length(trim(modalidad)) between 1 and 50),
  rei text not null check (rei = 'SIN REI' or rei ~ '^(0[1-9]|1[0-9])$'),
  alias text not null unique check (alias = lower(alias) and alias ~ '^[a-z0-9._-]+@ugel06[.]gob[.]pe$'),
  estado text not null default 'VACANTE' check (estado in ('VACANTE','OCUPADA','INACTIVA')),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo_institucional, modalidad)
);

create index if not exists director_iiee_plaza_estado_idx
  on public.director_iiee_plaza(estado, codigo_institucional);

create table if not exists public.director_iiee_plaza_asignacion (
  id uuid primary key default gen_random_uuid(),
  plaza_id uuid not null references public.director_iiee_plaza(id) on delete restrict,
  user_id uuid null references public.profiles(id) on delete set null,
  director_documento text not null,
  director_nombre text not null,
  assigned_by uuid null references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists director_iiee_plaza_asignacion_plaza_activa_uidx
  on public.director_iiee_plaza_asignacion(plaza_id)
  where ended_at is null;

create unique index if not exists director_iiee_plaza_asignacion_usuario_activo_uidx
  on public.director_iiee_plaza_asignacion(user_id)
  where ended_at is null and user_id is not null;

create index if not exists director_iiee_plaza_asignacion_historial_idx
  on public.director_iiee_plaza_asignacion(plaza_id, started_at desc);

create or replace function public.normalize_director_modalidad(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(trim(coalesce(p_value, '')), '[[:space:]]+', ' ', 'g'));
$$;

create or replace function public.director_modalidad_alias(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(
    translate(public.normalize_director_modalidad(p_value), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'),
    '[^A-Z0-9]+', '', 'g'
  ));
$$;

create or replace function public.normalize_director_rei(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when upper(trim(coalesce(p_value, ''))) in ('', 'SIN REI') then 'SIN REI'
    when upper(trim(p_value)) ~ '^(REI[[:space:]]*)?(0[1-9]|1[0-9]|[1-9])$'
      then lpad(regexp_replace(upper(trim(p_value)), '[^0-9]', '', 'g'), 2, '0')
    else null
  end;
$$;

create or replace function public.sync_director_iiee_plazas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  synchronized_count integer := 0;
  conflict_count integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'Solo el administrador puede sincronizar plazas de Director IIEE';
  end if;

  with normalized as (
    select
      trim(institution.codigo_institucional) as codigo_institucional,
      trim(coalesce(institution.nombre, 'INSTITUCION SIN NOMBRE')) as institucion_nombre,
      public.normalize_director_modalidad(modality.nombre) as modalidad,
      public.normalize_director_rei(institution.rei) as rei
    from public.institucion_educativa institution
    join public.cat_modalidad modality on modality.id = institution.modalidad_id
    where trim(coalesce(institution.codigo_institucional, '')) ~ '^[0-9]{8}$'
      and translate(upper(coalesce(institution.gestion, '')), 'ÁÉÍÓÚÜ', 'AEIOUU') like '%PUBLIC%'
  ), grouped as (
    select
      codigo_institucional,
      modalidad,
      min(institucion_nombre) as institucion_nombre,
      min(rei) as rei,
      count(distinct rei) as rei_count
    from normalized
    where modalidad <> '' and rei is not null
    group by codigo_institucional, modalidad
  ), upserted as (
    insert into public.director_iiee_plaza (
      codigo_institucional, institucion_nombre, modalidad, rei, alias, created_by
    )
    select
      codigo_institucional,
      institucion_nombre,
      modalidad,
      rei,
      codigo_institucional || '.' || public.director_modalidad_alias(modalidad) || '@ugel06.gob.pe',
      auth.uid()
    from grouped
    where rei_count = 1 and public.director_modalidad_alias(modalidad) <> ''
    on conflict (codigo_institucional, modalidad) do update
      set institucion_nombre = excluded.institucion_nombre,
          rei = excluded.rei,
          alias = excluded.alias,
          updated_at = now()
    returning 1
  )
  select count(*) into synchronized_count from upserted;

  with normalized as (
    select
      trim(institution.codigo_institucional) as codigo_institucional,
      public.normalize_director_modalidad(modality.nombre) as modalidad,
      public.normalize_director_rei(institution.rei) as rei
    from public.institucion_educativa institution
    join public.cat_modalidad modality on modality.id = institution.modalidad_id
    where trim(coalesce(institution.codigo_institucional, '')) ~ '^[0-9]{8}$'
      and translate(upper(coalesce(institution.gestion, '')), 'ÁÉÍÓÚÜ', 'AEIOUU') like '%PUBLIC%'
  )
  select count(*) into conflict_count
  from (
    select codigo_institucional, modalidad
    from normalized
    group by codigo_institucional, modalidad
    having count(distinct rei) > 1 or bool_or(rei is null)
  ) conflicts;

  update public.profiles profile
  set rei = plaza.rei,
      can_create_monitoreo = false,
      updated_at = now()
  from public.director_iiee_plaza_asignacion assignment
  join public.director_iiee_plaza plaza on plaza.id = assignment.plaza_id
  where assignment.user_id = profile.id
    and assignment.ended_at is null
    and profile.role = 'director_iiee'
    and (profile.rei is distinct from plaza.rei or profile.can_create_monitoreo is distinct from false);

  return jsonb_build_object(
    'synchronized', synchronized_count,
    'conflicts', conflict_count
  );
end;
$$;

revoke all on function public.sync_director_iiee_plazas() from public;
grant execute on function public.sync_director_iiee_plazas() to authenticated;

create or replace function public.validate_director_iiee_plaza_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  plaza_row public.director_iiee_plaza%rowtype;
begin
  if new.user_id is null then
    raise exception 'La asignacion activa requiere un usuario';
  end if;

  select * into profile_row from public.profiles where id = new.user_id;
  if profile_row.id is null or profile_row.role <> 'director_iiee' then
    raise exception 'El usuario debe tener el rol Director IIEE';
  end if;

  select * into plaza_row from public.director_iiee_plaza where id = new.plaza_id for update;
  if plaza_row.id is null or plaza_row.estado = 'INACTIVA' then
    raise exception 'La plaza no existe o esta inactiva';
  end if;

  new.director_documento := coalesce(nullif(trim(profile_row.numero_documento), ''), 'SIN DOCUMENTO');
  new.director_nombre := trim(concat_ws(' ', profile_row.apellido_paterno, profile_row.apellido_materno, profile_row.nombres));

  update public.profiles
  set rei = plaza_row.rei,
      can_create_monitoreo = false,
      updated_at = now()
  where id = new.user_id;

  return new;
end;
$$;

revoke all on function public.validate_director_iiee_plaza_assignment() from public;

drop trigger if exists validate_director_iiee_plaza_assignment on public.director_iiee_plaza_asignacion;
create trigger validate_director_iiee_plaza_assignment
before insert or update of plaza_id, user_id
on public.director_iiee_plaza_asignacion
for each row
when (new.ended_at is null and new.user_id is not null)
execute function public.validate_director_iiee_plaza_assignment();

create or replace function public.sync_director_iiee_plaza_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_plaza uuid;
begin
  affected_plaza := case when tg_op = 'DELETE' then old.plaza_id else new.plaza_id end;

  update public.director_iiee_plaza plaza
  set estado = case
        when plaza.estado = 'INACTIVA' then 'INACTIVA'
        when exists (
          select 1 from public.director_iiee_plaza_asignacion assignment
          where assignment.plaza_id = affected_plaza
            and assignment.ended_at is null
            and assignment.user_id is not null
        ) then 'OCUPADA'
        else 'VACANTE'
      end,
      updated_at = now()
  where plaza.id = affected_plaza;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.sync_director_iiee_plaza_state() from public;

drop trigger if exists sync_director_iiee_plaza_state on public.director_iiee_plaza_asignacion;
create trigger sync_director_iiee_plaza_state
after insert or update or delete on public.director_iiee_plaza_asignacion
for each row execute function public.sync_director_iiee_plaza_state();

create or replace function public.close_director_assignment_without_user()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is null and new.ended_at is null then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists close_director_assignment_without_user on public.director_iiee_plaza_asignacion;
create trigger close_director_assignment_without_user
before update of user_id on public.director_iiee_plaza_asignacion
for each row execute function public.close_director_assignment_without_user();

create or replace function public.sync_director_iiee_legacy_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  target_plaza uuid;
  target_code text;
begin
  if tg_op = 'DELETE' then
    target_user := old.user_id;
    target_plaza := old.plaza_id;
  else
    target_user := coalesce(new.user_id, old.user_id);
    target_plaza := new.plaza_id;
  end if;
  select codigo_institucional into target_code
  from public.director_iiee_plaza where id = target_plaza;

  if tg_op <> 'DELETE' and new.user_id is not null and new.ended_at is null then
    insert into public.director_iiee_institucion (user_id, codigo_institucional, assigned_by, assigned_at, updated_at)
    values (new.user_id, target_code, new.assigned_by, new.started_at, now())
    on conflict (user_id) do update
      set codigo_institucional = excluded.codigo_institucional,
          assigned_by = excluded.assigned_by,
          assigned_at = excluded.assigned_at,
          updated_at = now();
  elsif target_user is not null then
    delete from public.director_iiee_institucion
    where user_id = target_user and codigo_institucional = target_code;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.sync_director_iiee_legacy_assignment() from public;

drop trigger if exists sync_director_iiee_legacy_assignment on public.director_iiee_plaza_asignacion;
create trigger sync_director_iiee_legacy_assignment
after insert or update or delete on public.director_iiee_plaza_asignacion
for each row execute function public.sync_director_iiee_legacy_assignment();

create or replace function public.get_my_director_iiee_scope()
returns table (
  plaza_id uuid,
  codigo_institucional text,
  modalidad text,
  rei text,
  alias text
)
language sql
stable
security definer
set search_path = public
as $$
  select plaza.id, plaza.codigo_institucional, plaza.modalidad, plaza.rei, plaza.alias
  from public.director_iiee_plaza_asignacion assignment
  join public.director_iiee_plaza plaza on plaza.id = assignment.plaza_id
  where assignment.user_id = auth.uid()
    and assignment.ended_at is null
    and plaza.estado = 'OCUPADA';
$$;

revoke all on function public.get_my_director_iiee_scope() from public;
grant execute on function public.get_my_director_iiee_scope() to authenticated;

create or replace function public.director_iiee_can_access_institution(
  p_institution_id uuid,
  p_uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.director_iiee_plaza_asignacion assignment
    join public.director_iiee_plaza plaza on plaza.id = assignment.plaza_id
    join public.institucion_educativa institution
      on trim(institution.codigo_institucional) = plaza.codigo_institucional
    join public.cat_modalidad modality on modality.id = institution.modalidad_id
    where assignment.user_id = p_uid
      and assignment.ended_at is null
      and institution.id = p_institution_id
      and public.normalize_director_modalidad(modality.nombre) = plaza.modalidad
  );
$$;

revoke all on function public.director_iiee_can_access_institution(uuid,uuid) from public;
grant execute on function public.director_iiee_can_access_institution(uuid,uuid) to authenticated;

create or replace function public.enforce_director_iiee_profile_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'director_iiee' then
    new.can_create_monitoreo := false;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_director_iiee_profile_defaults on public.profiles;
create trigger enforce_director_iiee_profile_defaults
before insert or update on public.profiles
for each row execute function public.enforce_director_iiee_profile_defaults();

create or replace function public.can_create_monitoreo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when profile.role = 'director_iiee' then false
      when profile.role = 'user' then coalesce(profile.can_create_monitoreo, false)
      else true
    end
    from public.profiles profile
    where profile.id = auth.uid()
  ), false);
$$;

revoke all on function public.can_create_monitoreo() from public;
grant execute on function public.can_create_monitoreo() to authenticated;

-- Restablece el conjunto basico solicitado para Director IIEE.
delete from public.role_module_permission where role_code = 'director_iiee';
insert into public.role_module_permission (role_code, module_code, can_view, can_manage) values
  ('director_iiee','inicio',true,false),
  ('director_iiee','monitoreo',true,false),
  ('director_iiee','reportes',true,false),
  ('director_iiee','instituciones',true,false)
on conflict (role_code, module_code) do update
set can_view = excluded.can_view, can_manage = excluded.can_manage;

alter table public.director_iiee_plaza enable row level security;
alter table public.director_iiee_plaza_asignacion enable row level security;

grant select, insert, update on public.director_iiee_plaza to authenticated;
grant select, insert, update on public.director_iiee_plaza_asignacion to authenticated;

drop policy if exists director_iiee_plaza_admin_manage on public.director_iiee_plaza;
create policy director_iiee_plaza_admin_manage
on public.director_iiee_plaza for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists director_iiee_plaza_read_own on public.director_iiee_plaza;
create policy director_iiee_plaza_read_own
on public.director_iiee_plaza for select to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1 from public.director_iiee_plaza_asignacion assignment
    where assignment.plaza_id = id
      and assignment.user_id = auth.uid()
      and assignment.ended_at is null
  )
);

drop policy if exists director_iiee_plaza_assignment_admin_manage on public.director_iiee_plaza_asignacion;
create policy director_iiee_plaza_assignment_admin_manage
on public.director_iiee_plaza_asignacion for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists director_iiee_plaza_assignment_read_own on public.director_iiee_plaza_asignacion;
create policy director_iiee_plaza_assignment_read_own
on public.director_iiee_plaza_asignacion for select to authenticated
using (public.is_app_admin() or user_id = auth.uid());

comment on table public.director_iiee_plaza is
  'Plaza estable por codigo institucional y modalidad. REI y alias se derivan del catalogo institucional.';
comment on table public.director_iiee_plaza_asignacion is
  'Historial de directores que ocuparon cada plaza. Solo una asignacion activa por plaza y por usuario.';
