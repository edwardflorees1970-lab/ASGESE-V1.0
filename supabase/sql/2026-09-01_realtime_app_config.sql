-- app_config nunca se agrego a la publicacion de Realtime de Supabase, asi
-- que el canal "app_config_modo_test" (AppConfigProvider.tsx) se suscribia
-- sin error pero jamas recibia el evento postgres_changes en otros
-- navegadores -- el modo TEST/Produccion solo se actualizaba en tiempo
-- real para quien hacia el clic (estado local), y para el resto recien al
-- refrescar (F5) o al poll de 30s / cambio de pestana.
alter publication supabase_realtime add table public.app_config;
