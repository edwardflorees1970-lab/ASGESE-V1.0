-- Permisos de modulo para el rol Coordinador: Inicio (ver), Crear
-- Monitoreo (ver+gestionar, para crear/aprobar), Reportes y resultados
-- (ver, incluye descargar).
insert into public.role_module_permission (role_code, module_code, can_view, can_manage)
values
  ('coordinador','inicio',true,false),
  ('coordinador','gestion_monitoreos',true,true),
  ('coordinador','reportes',true,false)
on conflict (role_code, module_code) do update
  set can_view = excluded.can_view, can_manage = excluded.can_manage;
