# Módulo de reportes analíticos

## Arquitectura

Power BI continúa leyendo mediante el pooler. El módulo web no usa ni expone esas credenciales: consume RPC de Supabase con la sesión autenticada y respeta el RLS de las tablas base.

La migración `2026-08-01_analytics_reporting.sql` incorpora:

- relación normalizada de cada ficha con institución y monitoreo;
- backfill por código modular y, como alternativa, código local;
- vistas `analytics_run_fact` y `analytics_answer_fact` con `security_invoker`;
- índices de dimensiones, fechas, preguntas y respuestas;
- RPC para filtros, detalle por monitor, resultados e indicadores ejecutivos;
- límite de 15 segundos por consulta analítica y paginación de detalles.

## Reglas de datos

- `is_test = false` se aplica dentro de la vista base y no puede desactivarse desde el frontend.
- Se excluye el estado técnico `borrador`; los reportes distinguen `draft` y `final`.
- Sí/No se calcula sobre respuestas válidas.
- Sí/No con nivel genera dos dimensiones independientes: respuesta y nivel.
- En opción múltiple, el denominador es el número de fichas que respondieron; por ello la suma de alternativas puede superar 100 %.
- Las respuestas de texto libre no se usan para porcentajes ni matrices.
- Las respuestas numéricas se muestran por valor; los rangos y metas podrán añadirse mediante `config_json.reporting`.

## Orden de despliegue

1. Aplicar y verificar `2026-07-31_professional_hardening.sql`.
2. Crear un respaldo de las tablas `form_run` y `form_answer`.
3. Aplicar `2026-08-01_analytics_reporting.sql` en pruebas.
4. Comprobar cuántas fichas históricas quedaron sin institución:

   ```sql
   select count(*)
   from public.form_run
   where is_test = false and institucion_id is null;
   ```

5. Comparar los KPIs de la RPC con una consulta de control.
6. Desplegar el frontend.

## Pruebas rápidas

```sql
select public.report_filter_options('{}'::jsonb);
select public.report_executive_summary('{}'::jsonb);
select public.report_monitor_detail('{"year":"2026"}'::jsonb, 10, 0);
select public.report_question_results('{"year":"2026"}'::jsonb);
```

Estas consultas deben ejecutarse con un rol equivalente al usuario real para verificar las políticas RLS, no únicamente como propietario de la base de datos.

## Exportaciones

- CSV y Excel exportan los datos agregados o el detalle filtrado.
- Excel conserva cantidades como enteros y porcentajes como valores porcentuales nativos.
- La exportación detallada está limitada a 20 000 filas; para volúmenes superiores se exige aplicar filtros.
- PDF genera un documento A4 horizontal paginado, compacto, con filtros, usuario exportador y créditos del sistema.
- Cada gráfico dispone de vista ampliada, etiquetas internas, detalle estático y exportación independiente en PNG.
- Las matrices, la tabla de instituciones y el informe ejecutivo completo también pueden ampliarse y exportarse en PNG.
- La imagen PNG incluye el título, la visualización y el detalle inferior completo; su altura se calcula según el volumen mostrado.
