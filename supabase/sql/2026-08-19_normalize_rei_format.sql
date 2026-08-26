-- Normaliza valores REI reconocibles al catálogo canónico 01..19.
update public.profiles
set rei = lpad(regexp_replace(upper(trim(rei)), '[^0-9]', '', 'g'), 2, '0')
where rei is not null
  and upper(trim(rei)) ~ '^(REI[[:space:]]*)?(0[1-9]|1[0-9]|[1-9])$';

update public.institucion_educativa
set rei = lpad(regexp_replace(upper(trim(rei)), '[^0-9]', '', 'g'), 2, '0')
where rei is not null
  and upper(trim(rei)) ~ '^(REI[[:space:]]*)?(0[1-9]|1[0-9]|[1-9])$';
