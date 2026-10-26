-- Se retira de la interfaz el modulo "Auditoria y alertas" (operaciones).
-- Solo se desactiva: deja de aparecer en menu y en Roles y permisos. Los registros de auditoria y
-- telemetria siguen guardandose (sirven para investigar incidentes) y no se borra nada.
update public.app_module set is_active = false where code = 'operaciones';
