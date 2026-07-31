# Endurecimiento profesional 2026-07-31

## Alcance

Esta entrega incorpora controles para calidad continua, auditoria, integridad transaccional, versiones de plantillas, evidencias PDF, telemetria, accesibilidad y agregaciones de dashboard.

## Orden obligatorio de despliegue

1. Crear respaldo y validar que las migraciones anteriores ya fueron aplicadas.
2. Confirmar que `form_answer` no contiene más de una fila por `(run_id, question_id)`; la migración se detendrá sin eliminar datos si encuentra duplicados.
3. Ejecutar `supabase/sql/2026-07-31_professional_hardening.sql` en un ambiente de prueba.
4. Validar las RPC con usuarios de rol administrador y usuario operativo.
5. Desplegar el frontend. No invertir los pasos 3 y 5: las escrituras críticas ya no usan el flujo cliente no transaccional.
6. Configurar un consumidor de PostgreSQL `LISTEN app_telemetry_alert` o una integración equivalente para enviar los eventos `error` y `fatal` al canal operativo elegido.

## Verificaciones posteriores a la migracion

- Publicar una version de plantilla y comprobar que no admite `UPDATE` ni `DELETE`.
- Guardar, finalizar y eliminar una ficha; cada operación debe ser atómica y aparecer en `audit_event`.
- Aprobar una solicitud y verificar que monitoreo, fichas e instituciones se publican juntos.
- Subir un PDF valido menor de 5 MB; confirmar bucket privado, metadatos y SHA-256.
- Forzar un error controlado y comprobar su aparición en **Auditoria y alertas**.
- Comparar los indicadores del dashboard con una consulta de control antes de habilitar producción.

## Controles incorporados

| Control | Implementación |
|---|---|
| Auditoria | Tabla append-only, triggers uniformes y pantalla administrativa |
| Transacciones | RPC para guardar/eliminar fichas y publicar solicitudes |
| Versiones | Snapshot inmutable y referencia desde `form_run` |
| Evidencias | Bucket privado, limite 5 MB, firma PDF, SHA-256 y RLS |
| Telemetria | Tabla central, error boundary, errores globales y `pg_notify` |
| Rendimiento | Hechos agregados en servidor con fallback temporal de lectura |
| Calidad | TypeScript, ESLint, Vitest con umbrales, build y GitHub Actions |

## Riesgos residuales conocidos

- `GestionMonitoreosPage.tsx`, `ReportesPage.tsx` y `FichaDinamicaPage.tsx` siguen siendo archivos grandes. Los flujos de datos críticos ya se extrajeron a módulos, pero la descomposición visual debe continuar por secciones en entregas pequeñas con pruebas de regresión.
- Permanecen nueve advertencias históricas de dependencias de hooks, congeladas como presupuesto máximo en CI. No hay errores ESLint bloqueantes.
- `npm audit --omit=dev` aún informa avisos en `exceljs` y React Router sin una corrección compatible y segura ofrecida por npm. No se aplicó `--force`; la superficie afectada debe revisarse al publicar versiones corregidas.
- La migración requiere validación contra el proyecto Supabase destino; el build local no prueba políticas ni datos reales del ambiente remoto.
