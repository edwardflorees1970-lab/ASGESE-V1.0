-- Meta de fichas por especialista y monitoreo (null = sin meta, comportamiento anterior).
-- Aplicada en produccion como "monitoreo_meta_fichas_por_especialista" y "fix_guard_form_run_meta_rls".
alter table public.monitoreo_asignacion
  add column if not exists meta_fichas integer
  check (meta_fichas is null or (meta_fichas >= 0 and meta_fichas <= 100000));

-- Una asignacion con meta deja de depender del rol: reconcile_role_assignments borra y recrea las 'role'.
create or replace function public.keep_meta_assignments_manual()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.meta_fichas is not null and new.assignment_source = 'role' then
    new.assignment_source := 'manual';
    new.source_role_code := null;
  end if;
  return new;
end;
$$;
drop trigger if exists keep_meta_assignments_manual on public.monitoreo_asignacion;
create trigger keep_meta_assignments_manual
  before insert or update on public.monitoreo_asignacion
  for each row execute function public.keep_meta_assignments_manual();

create or replace function public.reconcile_role_assignments(p_monitoreo_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.monitoreo_asignacion
  where monitoreo_id = p_monitoreo_id and assignment_source = 'role' and meta_fichas is null;

  insert into public.monitoreo_asignacion (monitoreo_id, user_id, assignment_source, source_role_code)
  select p_monitoreo_id, p.id, 'role', p.role
  from public.profiles p
  join public.monitoreo_role_asignacion ra on ra.role_code = p.role and ra.monitoreo_id = p_monitoreo_id
  on conflict (monitoreo_id, user_id) do nothing;
end;
$function$;

-- La consulta debe ver todas las asignaciones del monitoreo (RLS solo deja ver la propia fila).
create or replace function public.monitoreo_meta_blocks_user(p_monitoreo uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.monitoreo_asignacion a where a.monitoreo_id = p_monitoreo and a.meta_fichas is not null)
     and not exists (select 1 from public.monitoreo_asignacion a
                     where a.monitoreo_id = p_monitoreo and a.user_id = p_user and a.meta_fichas is not null);
$$;
revoke all on function public.monitoreo_meta_blocks_user(uuid, uuid) from public, anon;
grant execute on function public.monitoreo_meta_blocks_user(uuid, uuid) to authenticated, service_role;

-- Regla real: si el monitoreo tiene metas, solo suben fichas quienes tengan meta asignada.
-- Trigger NO definer: current_user es 'authenticated' solo en llamadas directas del cliente.
create or replace function public.guard_form_run_meta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and new.monitoreo_id is not null and not public.is_admin() then
    if public.monitoreo_meta_blocks_user(new.monitoreo_id, new.created_by) then
      raise exception 'No tienes una meta de fichas asignada en este monitoreo' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists aa_guard_form_run_meta on public.form_run;
create trigger aa_guard_form_run_meta
  before insert on public.form_run
  for each row execute function public.guard_form_run_meta();

-- Etiqueta de excedente: la ficha n+1 en adelante (por orden de creacion) de quien tiene meta.
-- Vista con owner (ve todo) y filtro explicito equivalente a las policies de form_run.
create or replace view public.form_run_meta as
select r.id as run_id,
       r.monitoreo_id,
       r.created_by,
       a.meta_fichas,
       row_number() over (partition by r.monitoreo_id, r.created_by order by r.created_at, r.id) as ordinal,
       (a.meta_fichas is not null
        and row_number() over (partition by r.monitoreo_id, r.created_by order by r.created_at, r.id) > a.meta_fichas) as excede_meta
from public.form_run r
left join public.monitoreo_asignacion a on a.monitoreo_id = r.monitoreo_id and a.user_id = r.created_by
where r.created_by = (select auth.uid())
   or (select public.can_supervise_all())
   or public.is_admin();

-- Avance contra meta por especialista (misma visibilidad).
create or replace view public.monitoreo_meta_avance as
select a.monitoreo_id,
       a.user_id,
       a.meta_fichas,
       count(r.id) as subidas,
       count(r.id) filter (where r.status = 'final') as finalizadas,
       greatest(count(r.id) - a.meta_fichas, 0) as excedentes
from public.monitoreo_asignacion a
left join public.form_run r on r.monitoreo_id = a.monitoreo_id and r.created_by = a.user_id
where a.meta_fichas is not null
  and (a.user_id = (select auth.uid()) or (select public.can_supervise_all()) or public.is_admin()
       or public.can_manage_app_module('asignaciones'))
group by a.monitoreo_id, a.user_id, a.meta_fichas;

revoke all on public.form_run_meta, public.monitoreo_meta_avance from public, anon;
grant select on public.form_run_meta, public.monitoreo_meta_avance to authenticated, service_role;

-- Datos del monitoreo SUPERVICION CUMPLIMIENTO JORNADA LABORAL (2026-10-07), aplicados a mano:
--   update monitoreo_asignacion set meta_fichas = 100 where monitoreo_id = '833c29b1-63a4-47ed-9bfe-8aac676fa653'
--     and user_id in (Roxana Choquepata, Jenny Flores);
--   delete from monitoreo_role_asignacion where monitoreo_id = '833c29b1-...' and role_code = 'user';
--   select reconcile_role_assignments('833c29b1-63a4-47ed-9bfe-8aac676fa653');
