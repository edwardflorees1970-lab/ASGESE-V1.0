-- Fichas reales agrupan preguntas dentro de una seccion bajo subtitulos
-- (ej. seccion "XIII. MATERIALES..." con subtitulos "1. MONITOREO DE
-- RECEPCION..." / "2. DISTRIBUCION INTERNA...", cada uno con sus propias
-- preguntas). El constructor solo tenia Seccion > Preguntas (plano).
-- Columna opcional: si se llena, las preguntas consecutivas con el mismo
-- subtitulo se agrupan bajo un encabezado en el constructor, el llenado
-- y el PDF; si queda vacia, todo se comporta exactamente igual que hoy.
alter table public.form_question
  add column if not exists subtitulo text;
