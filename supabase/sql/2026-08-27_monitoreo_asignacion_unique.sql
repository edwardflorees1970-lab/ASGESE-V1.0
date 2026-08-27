-- reconcile_role_assignments() does
--   insert into monitoreo_asignacion (...) on conflict (monitoreo_id, user_id) do nothing
-- but no unique constraint on (monitoreo_id, user_id) ever existed on this
-- table, so every bulk role assignment in Asignaciones failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". No duplicate rows existed, so this is safe to add as-is.
alter table public.monitoreo_asignacion
  add constraint monitoreo_asignacion_monitoreo_user_key unique (monitoreo_id, user_id);
