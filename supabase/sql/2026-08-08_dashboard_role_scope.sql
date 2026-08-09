-- Dashboard por alcance de rol.
-- Roles de supervisión ven el consolidado; los demás usuarios solo sus registros.

create or replace function public.can_view_global_dashboard(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('admin', 'jefe_area', 'director')
  );
$$;

revoke all on function public.can_view_global_dashboard(uuid) from public, anon;
grant execute on function public.can_view_global_dashboard(uuid) to authenticated;

create or replace function public.dashboard_run_facts(
  p_from timestamptz,
  p_to timestamptz,
  p_is_test boolean,
  p_template_ids uuid[] default null
)
returns table(id text,status text,created_by uuid,created_at timestamptz,template_id uuid,run_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select min(r.id::text), r.status, r.created_by, date_trunc('day', r.created_at), r.template_id, count(*)
  from public.form_run r
  where auth.uid() is not null
    and r.created_at >= p_from
    and r.created_at < p_to
    and r.is_test = p_is_test
    and r.status <> 'borrador'
    and (p_template_ids is null or r.template_id = any(p_template_ids))
    and (
      public.can_view_global_dashboard(auth.uid())
      or r.created_by = auth.uid()
    )
  group by r.status, r.created_by, date_trunc('day', r.created_at), r.template_id;
$$;

revoke all on function public.dashboard_run_facts(timestamptz,timestamptz,boolean,uuid[]) from public, anon;
grant execute on function public.dashboard_run_facts(timestamptz,timestamptz,boolean,uuid[]) to authenticated;
