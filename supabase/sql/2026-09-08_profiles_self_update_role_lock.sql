-- La politica self_update de profiles permitia a cualquier usuario
-- autenticado editar su propia fila sin restringir que columnas podia
-- cambiar. Como "role" vive en esa misma fila, un usuario con rol bajo
-- podia auto-promoverse a admin llamando directo a la API REST:
--   PATCH /rest/v1/profiles?id=eq.<su-propio-id>  { "role": "admin" }
-- sin pasar por la app en absoluto. El with_check exige ahora que el
-- "role" del UPDATE sea el mismo que ya tenia -- cualquier intento de
-- cambiarlo hace fallar el UPDATE completo.
drop policy if exists self_update on public.profiles;

create policy self_update on public.profiles for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select role from public.profiles where id = auth.uid())
);
