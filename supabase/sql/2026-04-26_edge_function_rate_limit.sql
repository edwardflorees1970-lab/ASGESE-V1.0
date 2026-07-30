create table if not exists public.edge_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists edge_rate_limits_updated_at_idx on public.edge_rate_limits (updated_at);

alter table public.edge_rate_limits enable row level security;

revoke all on table public.edge_rate_limits from public;
revoke all on table public.edge_rate_limits from anon;
revoke all on table public.edge_rate_limits from authenticated;
grant all on table public.edge_rate_limits to service_role;

create or replace function public.enforce_edge_rate_limit(
  p_key text,
  p_max_hits integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_threshold timestamptz := v_now - make_interval(secs => greatest(1, p_window_seconds));
  v_count integer;
  v_start timestamptz;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'p_key is required';
  end if;

  insert into public.edge_rate_limits as rl (key, window_start, hit_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
  set
    hit_count = case
      when rl.window_start <= v_window_threshold then 1
      else rl.hit_count + 1
    end,
    window_start = case
      when rl.window_start <= v_window_threshold then v_now
      else rl.window_start
    end,
    updated_at = v_now
  returning hit_count, window_start into v_count, v_start;

  reset_at := v_start + make_interval(secs => greatest(1, p_window_seconds));
  allowed := v_count <= greatest(1, p_max_hits);
  remaining := greatest(0, greatest(1, p_max_hits) - v_count);
  retry_after_seconds := greatest(0, ceil(extract(epoch from (reset_at - v_now)))::integer);

  return next;
end;
$$;

revoke all on function public.enforce_edge_rate_limit(text, integer, integer) from public;
grant execute on function public.enforce_edge_rate_limit(text, integer, integer) to service_role;

create or replace function public.cleanup_edge_rate_limits(p_older_than interval default interval '1 day')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.edge_rate_limits
  where updated_at < now() - p_older_than;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_edge_rate_limits(interval) from public;
grant execute on function public.cleanup_edge_rate_limits(interval) to service_role;

create extension if not exists pg_cron with schema extensions;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup_edge_rate_limits_every_30m';

    perform cron.schedule(
      'cleanup_edge_rate_limits_every_30m',
      '*/30 * * * *',
      $sql$select public.cleanup_edge_rate_limits(interval '1 day');$sql$
    );
  end if;
end
$do$;
