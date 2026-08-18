-- Trazabilidad de cargas masivas de usuarios. No almacena contraseñas.
create table if not exists public.user_import_job (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null check (total_rows between 1 and 300),
  status text not null default 'processing' check (status in ('processing','completed','completed_with_errors')),
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.user_import_job drop column if exists invite_redirect_url;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.user_import_row (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.user_import_job(id) on delete cascade,
  source_row integer not null check (source_row >= 2),
  correo text not null,
  numero_documento text not null,
  input_data jsonb not null default '{}'::jsonb,
  status text not null check (status in ('created','skipped','error')),
  message text not null,
  created_user_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (job_id, source_row)
);

create index if not exists user_import_job_created_by_idx on public.user_import_job(created_by, created_at desc);
create index if not exists user_import_row_job_status_idx on public.user_import_row(job_id, status);

alter table public.user_import_job enable row level security;
alter table public.user_import_row enable row level security;
grant select on public.user_import_job, public.user_import_row to authenticated;

drop policy if exists user_import_job_admin_read on public.user_import_job;
create policy user_import_job_admin_read on public.user_import_job for select to authenticated
using (public.is_app_admin() and created_by = auth.uid());

drop policy if exists user_import_row_admin_read on public.user_import_row;
create policy user_import_row_admin_read on public.user_import_row for select to authenticated
using (exists (
  select 1 from public.user_import_job job
  where job.id = job_id and job.created_by = auth.uid() and public.is_app_admin()
));

create or replace function public.clear_initial_password_change_on_auth_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
    set must_change_password = false,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_initial_password_change_on_auth_update() from public;

drop trigger if exists clear_initial_password_change_on_auth_update on auth.users;
create trigger clear_initial_password_change_on_auth_update
after update of encrypted_password on auth.users
for each row execute function public.clear_initial_password_change_on_auth_update();
