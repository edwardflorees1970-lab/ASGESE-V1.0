-- profiles.correo tenia un CHECK que exigia el dominio @ugel06.gob.pe,
-- bloqueando a nivel de base de datos la creacion de usuarios con correo
-- externo aunque la Edge Function ya no lo exigiera. Se reemplaza por una
-- validacion de formato de email generico (sin restriccion de dominio).
alter table public.profiles drop constraint if exists profiles_correo_check;
alter table public.profiles
  add constraint profiles_correo_check
  check (correo ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$');
