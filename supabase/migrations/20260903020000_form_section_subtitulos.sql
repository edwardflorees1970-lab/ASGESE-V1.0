-- Correccion de jerarquia: Seccion > Subtitulo > Preguntas. Los
-- subtitulos ahora se crean/gestionan a nivel de Seccion (esta columna),
-- y la pregunta solo elige de esa lista (ya no escribe texto libre) --
-- form_question.subtitulo (de la migracion anterior) sigue guardando el
-- nombre elegido, sin cambios ahi.
alter table public.form_section
  add column if not exists subtitulos text[] not null default '{}'::text[];
