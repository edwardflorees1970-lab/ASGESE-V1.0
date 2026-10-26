-- Padron de IE para "Seguimiento > Instituciones educativas".
-- Devuelve todo el padron en una sola llamada (la API REST corta en 1000 filas) con nivel y
-- distrito resueltos. Solo roles de supervision.
create or replace function public.seguimiento_padron_ie()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.can_supervise_all(auth.uid()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ie.id,
      'nombre', ie.nombre,
      'cm', ie.codigo_modular,
      'cl', ie.codigo_local,
      'nivel', n.nombre,
      'rei', nullif(btrim(ie.rei), ''),
      'distrito', d.nombre,
      'gestion', ie.gestion,
      'director', ie.director,
      'telefono', ie.telefono
    ) order by ie.nombre)
    from public.institucion_educativa ie
    left join public.cat_nivel n on n.id = ie.nivel_id
    left join public.cat_distrito d on d.id = ie.distrito_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.seguimiento_padron_ie() from public, anon;
grant execute on function public.seguimiento_padron_ie() to authenticated;
