-- Un Director IIEE mantiene una sola asignación vigente a un colegio público.
create table if not exists public.director_iiee_institucion (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  codigo_institucional text not null check (codigo_institucional ~ '^[0-9]{8}$'),
  assigned_by uuid null references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_iiee_institucion_codigo_idx
  on public.director_iiee_institucion(codigo_institucional);

create index if not exists institucion_educativa_codigo_institucional_idx
  on public.institucion_educativa(codigo_institucional)
  where codigo_institucional is not null;

create or replace function public.validate_director_iiee_institucion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = new.user_id and profile.role = 'director_iiee'
  ) then
    raise exception 'El usuario debe tener el rol Director IIEE';
  end if;

  if not exists (
    select 1
    from public.institucion_educativa institution
    where trim(institution.codigo_institucional) = new.codigo_institucional
      and translate(upper(coalesce(institution.gestion, '')), 'ÁÉÍÓÚÜ', 'AEIOUU') like '%PUBLIC%'
  ) then
    raise exception 'El código institucional no corresponde a un colegio público registrado';
  end if;

  if tg_op = 'UPDATE' and new.codigo_institucional is distinct from old.codigo_institucional then
    new.assigned_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_director_iiee_institucion() from public;

drop trigger if exists validate_director_iiee_institucion on public.director_iiee_institucion;
create trigger validate_director_iiee_institucion
before insert or update on public.director_iiee_institucion
for each row execute function public.validate_director_iiee_institucion();

alter table public.director_iiee_institucion enable row level security;
grant select on public.director_iiee_institucion to authenticated;

drop policy if exists director_iiee_institucion_read on public.director_iiee_institucion;
create policy director_iiee_institucion_read
on public.director_iiee_institucion
for select to authenticated
using (user_id = auth.uid() or public.is_app_admin());
