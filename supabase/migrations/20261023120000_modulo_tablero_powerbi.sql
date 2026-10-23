-- Modulo "Tablero Power BI": informe incrustado, solo para roles de supervision.
-- Aplicada en produccion como "modulo_tablero_powerbi" (2026-10-23).
insert into public.app_module (code, name, description, sort_order, is_active)
values ('tablero_powerbi', 'Tablero Power BI', 'Informe en vivo de Power BI incrustado en el sistema', 75, true)
on conflict (code) do nothing;

insert into public.role_module_permission (role_code, module_code, can_view, can_manage)
values ('admin', 'tablero_powerbi', true, true),
       ('jefe_area', 'tablero_powerbi', true, false),
       ('director', 'tablero_powerbi', true, false),
       ('coordinador', 'tablero_powerbi', true, false)
on conflict (role_code, module_code) do update set can_view = excluded.can_view;
