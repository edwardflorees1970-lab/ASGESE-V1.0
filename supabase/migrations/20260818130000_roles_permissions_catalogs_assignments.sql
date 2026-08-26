-- Roles dinamicos, permisos por modulo y asignaciones masivas por rol.
-- Ejecutar en el proyecto Supabase antes de habilitar las nuevas pantallas.

create table if not exists public.app_role (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  name text not null unique,
  description text null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_role (code, name, is_system) values
  ('admin', 'Administrador', true),
  ('user', 'Monitor', true),
  ('jefe_area', 'Jefe de area', true),
  ('director', 'Director(a)', true),
  ('responsable_cdd', 'Responsable CdD', true),
  ('director_iiee', 'Director IIEE', true)
on conflict (code) do update set name = excluded.name;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_role_fkey;
alter table public.profiles
  add constraint profiles_role_fkey foreign key (role) references public.app_role(code)
  on update cascade on delete restrict not valid;

create table if not exists public.app_module (
  code text primary key,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.app_module (code, name, sort_order) values
  ('inicio', 'Inicio', 10), ('monitoreo', 'Monitoreo', 20),
  ('seguimiento', 'Seguimiento', 30), ('gestion_monitoreos', 'Gestion de monitoreos', 40),
  ('asignaciones', 'Asignaciones', 50), ('reportes', 'Reportes y resultados', 60),
  ('reportes_analiticos', 'Reportes analiticos', 70), ('indicadores_cdd', 'Indicadores CdD', 80),
  ('instituciones', 'Instituciones', 90), ('usuarios', 'Usuarios', 100),
  ('roles_permisos', 'Roles y permisos', 110), ('catalogos', 'Catalogos', 120),
  ('operaciones', 'Auditoria y alertas', 130)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

create table if not exists public.role_module_permission (
  role_code text not null references public.app_role(code) on update cascade on delete cascade,
  module_code text not null references public.app_module(code) on update cascade on delete cascade,
  can_view boolean not null default false,
  can_manage boolean not null default false,
  primary key (role_code, module_code),
  check (not can_manage or can_view)
);

insert into public.role_module_permission (role_code, module_code, can_view, can_manage)
select r.code, m.code, true,
  case when r.code = 'admin' then true else false end
from public.app_role r cross join public.app_module m
where r.code = 'admin'
on conflict (role_code, module_code) do update set can_view = true, can_manage = true;

insert into public.role_module_permission (role_code, module_code, can_view, can_manage) values
  ('user','inicio',true,false), ('user','monitoreo',true,false), ('user','reportes',true,false),
  ('user','reportes_analiticos',true,false), ('user','instituciones',true,false),
  ('jefe_area','inicio',true,false), ('jefe_area','monitoreo',true,false), ('jefe_area','seguimiento',true,true),
  ('jefe_area','gestion_monitoreos',true,true), ('jefe_area','asignaciones',true,true),
  ('jefe_area','reportes',true,false), ('jefe_area','reportes_analiticos',true,false),
  ('jefe_area','indicadores_cdd',true,false), ('jefe_area','instituciones',true,false), ('jefe_area','usuarios',true,false),
  ('director','inicio',true,false), ('director','monitoreo',true,false), ('director','seguimiento',true,true),
  ('director','gestion_monitoreos',true,true), ('director','asignaciones',true,true),
  ('director','reportes',true,false), ('director','reportes_analiticos',true,false),
  ('director','indicadores_cdd',true,false), ('director','instituciones',true,false), ('director','usuarios',true,false),
  ('responsable_cdd','inicio',true,false), ('responsable_cdd','monitoreo',true,false),
  ('responsable_cdd','reportes',true,false), ('responsable_cdd','reportes_analiticos',true,false),
  ('responsable_cdd','indicadores_cdd',true,false), ('responsable_cdd','instituciones',true,false),
  ('director_iiee','inicio',true,false), ('director_iiee','monitoreo',true,false),
  ('director_iiee','reportes',true,false), ('director_iiee','instituciones',true,false)
on conflict (role_code, module_code) do nothing;

create or replace function public.is_app_admin(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = p_uid and p.role = 'admin');
$$;

alter table public.app_role enable row level security;
alter table public.app_module enable row level security;
alter table public.role_module_permission enable row level security;
grant select, insert, update, delete on public.app_role to authenticated;
grant select, insert, update, delete on public.app_module to authenticated;
grant select, insert, update, delete on public.role_module_permission to authenticated;
drop policy if exists app_role_read on public.app_role;
create policy app_role_read on public.app_role for select to authenticated using (true);
drop policy if exists app_role_admin on public.app_role;
create policy app_role_admin on public.app_role for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists app_module_read on public.app_module;
create policy app_module_read on public.app_module for select to authenticated using (true);
drop policy if exists app_module_admin on public.app_module;
create policy app_module_admin on public.app_module for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists role_permission_read on public.role_module_permission;
create policy role_permission_read on public.role_module_permission for select to authenticated
using (public.is_app_admin() or role_code = (select p.role from public.profiles p where p.id = auth.uid()));
drop policy if exists role_permission_admin on public.role_module_permission;
create policy role_permission_admin on public.role_module_permission for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.get_my_module_permissions()
returns table(module_code text, can_view boolean, can_manage boolean)
language sql stable security definer set search_path = public as $$
  select m.code, coalesce(p.can_view, false), coalesce(p.can_manage, false)
  from public.app_module m
  left join public.profiles pr on pr.id = auth.uid()
  left join public.role_module_permission p on p.module_code = m.code and p.role_code = pr.role
  where m.is_active;
$$;
revoke all on function public.get_my_module_permissions() from public;
grant execute on function public.get_my_module_permissions() to authenticated;

create or replace function public.can_manage_app_module(p_module_code text, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_admin(p_uid) or exists (
    select 1 from public.profiles pr
    join public.role_module_permission rp on rp.role_code = pr.role
    where pr.id = p_uid and rp.module_code = p_module_code and rp.can_manage
  );
$$;

alter table public.monitoreo_asignacion
  add column if not exists assignment_source text not null default 'manual'
    check (assignment_source in ('manual','role')),
  add column if not exists source_role_code text null references public.app_role(code) on update cascade on delete set null;

create table if not exists public.monitoreo_role_asignacion (
  monitoreo_id uuid not null references public.monitoreo_catalog(id) on delete cascade,
  role_code text not null references public.app_role(code) on update cascade on delete cascade,
  assigned_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (monitoreo_id, role_code)
);
alter table public.monitoreo_role_asignacion enable row level security;
grant select on public.monitoreo_role_asignacion to authenticated;
drop policy if exists monitoreo_role_read on public.monitoreo_role_asignacion;
create policy monitoreo_role_read on public.monitoreo_role_asignacion for select to authenticated using (public.can_manage_app_module('asignaciones'));
drop policy if exists monitoreo_assignment_module_manage on public.monitoreo_asignacion;
create policy monitoreo_assignment_module_manage on public.monitoreo_asignacion for all to authenticated
using (public.can_manage_app_module('asignaciones')) with check (public.can_manage_app_module('asignaciones'));

create or replace function public.reconcile_role_assignments(p_monitoreo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.monitoreo_asignacion
  where monitoreo_id = p_monitoreo_id and assignment_source = 'role';

  insert into public.monitoreo_asignacion (monitoreo_id, user_id, assignment_source, source_role_code)
  select p_monitoreo_id, p.id, 'role', p.role
  from public.profiles p
  join public.monitoreo_role_asignacion ra on ra.role_code = p.role and ra.monitoreo_id = p_monitoreo_id
  on conflict (monitoreo_id, user_id) do nothing;
end;
$$;

create or replace function public.set_monitoreo_role_assignment(p_monitoreo_id uuid, p_role_code text, p_assigned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_app_module('asignaciones') then raise exception 'No tienes permiso para gestionar asignaciones'; end if;
  if p_assigned then
    insert into public.monitoreo_role_asignacion(monitoreo_id, role_code, assigned_by)
    values (p_monitoreo_id, p_role_code, auth.uid()) on conflict do nothing;
  else
    delete from public.monitoreo_role_asignacion where monitoreo_id = p_monitoreo_id and role_code = p_role_code;
  end if;
  perform public.reconcile_role_assignments(p_monitoreo_id);
end;
$$;
revoke all on function public.set_monitoreo_role_assignment(uuid,text,boolean) from public;
grant execute on function public.set_monitoreo_role_assignment(uuid,text,boolean) to authenticated;

create or replace function public.sync_profile_role_assignments()
returns trigger language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if tg_op = 'UPDATE' and old.role is not distinct from new.role then return new; end if;
  for item in select distinct monitoreo_id from public.monitoreo_role_asignacion
    where role_code = new.role or (tg_op = 'UPDATE' and role_code = old.role)
  loop perform public.reconcile_role_assignments(item.monitoreo_id); end loop;
  return new;
end;
$$;
drop trigger if exists profiles_sync_role_assignments on public.profiles;
create trigger profiles_sync_role_assignments after insert or update of role on public.profiles
for each row execute function public.sync_profile_role_assignments();

-- Los catalogos existentes quedan editables solo por administrador.
do $$ declare t text; begin
  foreach t in array array['cat_nivel','cat_modalidad','cat_ugel','cat_distrito','cat_departamento','cat_provincia','cat_dre'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_admin_manage', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.can_manage_app_module(''catalogos'')) with check (public.can_manage_app_module(''catalogos''))', t || '_admin_manage', t);
    end if;
  end loop;
end $$;
