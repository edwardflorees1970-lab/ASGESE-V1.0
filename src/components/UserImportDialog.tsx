import { useMemo, useRef, useState } from "react";
import { adminFinishUserImport, adminProcessUserImport, adminStartUserImport } from "../lib/adminApi";
import { supabase } from "../lib/supabaseClient";
import { directorPlazaKey, downloadUserImportResults, readUserImportFile, validateUserImportRows } from "../lib/userImport";
import type { DirectorPlazaInfo, UserImportInput, UserImportPreviewRow, UserImportResultRow } from "../lib/userImport";

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function existingValues(values: string[], column: "correo" | "numero_documento") {
  const found = new Set<string>();
  for (const part of chunks(Array.from(new Set(values.filter(Boolean))), 100)) {
    if (!part.length) continue;
    const { data, error } = await supabase.from("profiles").select(column).in(column, part);
    if (error) throw new Error(`No se pudieron contrastar usuarios existentes: ${error.message}`);
    for (const row of data ?? []) {
      const value = String((row as Record<string, unknown>)[column] ?? "").trim();
      if (value) found.add(column === "correo" ? value.toLowerCase() : value);
    }
  }
  return found;
}

async function directorPlazaValues(values: Array<{ codigo: string; modalidad: string }>) {
  const found = new Map<string, DirectorPlazaInfo>();
  const codes = Array.from(new Set(values.map((value) => value.codigo).filter((value) => /^\d{8}$/.test(value))));
  for (const part of chunks(codes, 100)) {
    if (!part.length) continue;
    const { data, error } = await supabase
      .from("director_iiee_plaza")
      .select("id,codigo_institucional,institucion_nombre,modalidad,rei,alias,estado")
      .in("codigo_institucional", part);
    if (error) throw new Error(`No se pudieron consultar las plazas de Director IIEE: ${error.message}`);
    for (const row of data ?? []) {
      const info: DirectorPlazaInfo = {
        id: String(row.id),
        codigoInstitucional: String(row.codigo_institucional ?? "").trim(),
        institucionNombre: String(row.institucion_nombre ?? "INSTITUCIÓN SIN NOMBRE").trim(),
        modalidad: String(row.modalidad ?? "").trim(),
        rei: String(row.rei ?? "SIN REI").trim(),
        alias: String(row.alias ?? "").trim().toLowerCase(),
        estado: row.estado as DirectorPlazaInfo["estado"],
      };
      found.set(directorPlazaKey(info.codigoInstitucional, info.modalidad), info);
    }
  }
  return found;
}

export function UserImportDialog({ roles, onClose, onComplete }: { roles: Array<{ code: string; name: string }>; onClose: () => void; onComplete: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<UserImportPreviewRow[]>([]);
  const [results, setResults] = useState<UserImportResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  const previewSummary = useMemo(() => ({ total: preview.length, valid: preview.filter((row) => row.status === "valid").length, invalid: preview.filter((row) => row.status === "invalid").length, warnings: preview.filter((row) => row.warnings.length > 0).length }), [preview]);
  const resultSummary = useMemo(() => ({ created: results.filter((row) => row.status === "created").length, skipped: results.filter((row) => row.status === "skipped").length, errors: results.filter((row) => row.status === "error").length }), [results]);

  const selectFile = async (file: File) => {
    setBusy(true); setError(""); setCompleted(false); setResults([]); setPreview([]); setFileName(file.name);
    try {
      const raw = await readUserImportFile(file);
      const roleCodes = new Set(roles.map((role) => role.code));
      const local = validateUserImportRows(raw, roleCodes);
      const plazas = await directorPlazaValues(local
        .filter((row) => row.rol === "director_iiee")
        .map((row) => ({ codigo: row.codigo_institucional ?? "", modalidad: row.modalidad ?? "" })));
      const resolved = validateUserImportRows(raw, roleCodes, new Set(), new Set(), plazas);
      const [emails, documents] = await Promise.all([
        existingValues(resolved.map((row) => row.correo), "correo"),
        existingValues(resolved.map((row) => row.numero_documento), "numero_documento"),
      ]);
      setPreview(validateUserImportRows(raw, roleCodes, emails, documents, plazas));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer la plantilla.");
    } finally { setBusy(false); }
  };

  const processImport = async () => {
    if (!preview.length || previewSummary.valid === 0) return;
    setBusy(true); setError(""); setResults([]); setProgress(0);
    try {
      const { job_id: jobId } = await adminStartUserImport(fileName, preview.length);
      const allResults: UserImportResultRow[] = [];
      const batches = chunks(preview, 20);
      for (let index = 0; index < batches.length; index += 1) {
        const payload = batches[index].map((previewRow) => {
          const row = { ...previewRow } as Partial<UserImportPreviewRow>;
          delete row.errors;
          delete row.warnings;
          delete row.institucion_nombre;
          return { ...row, validation_errors: previewRow.errors } as UserImportInput & { validation_errors: string[] };
        });
        const response = await adminProcessUserImport(jobId, payload);
        allResults.push(...response.items);
        setResults([...allResults]);
        setProgress(Math.round(((index + 1) / batches.length) * 100));
      }
      await adminFinishUserImport(jobId);
      setCompleted(true); onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La carga se interrumpió. Puedes volver a intentarla; no se duplicarán usuarios ya creados.");
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="user-import-title">
    <div className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4"><div><div className="text-xs font-bold uppercase tracking-widest text-sky-300">Carga controlada</div><h2 id="user-import-title" className="mt-1 text-xl font-bold text-white">Importar usuarios desde Excel</h2><p className="mt-1 text-sm text-white/55">Valida los datos antes de crear cuentas y conserva un resumen por fila.</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70">Cerrar</button></header>
      <div className="max-h-[78vh] overflow-y-auto p-5">
        <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_auto_auto] md:items-end"><div><div className="text-sm font-semibold text-white">1. Descarga y completa la plantilla</div><div className="mt-1 text-xs text-white/50">No cambies la hoja Usuarios ni sus encabezados.</div></div><a href="/plantilla_carga_usuarios.xlsx" download className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-center text-sm font-semibold text-sky-100">Descargar plantilla</a><button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && !preview.length ? "Leyendo..." : "Seleccionar Excel"}</button><input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectFile(file); event.target.value = ""; }}/></section>
        {fileName && <div className="mt-3 text-xs text-white/50">Archivo: <span className="font-semibold text-white/75">{fileName}</span></div>}
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

        {preview.length > 0 && !completed && <section className="mt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-sm font-semibold text-white">2. Vista previa y validación</div><div className="mt-1 text-xs text-white/50">Solo se crearán filas válidas. Las observadas quedarán registradas como error.</div></div><div className="grid grid-cols-4 gap-2"><Summary label="Total" value={previewSummary.total}/><Summary label="Válidos" value={previewSummary.valid} tone="green"/><Summary label="Advertencias" value={previewSummary.warnings} tone="amber"/><Summary label="Observados" value={previewSummary.invalid} tone="red"/></div></div><div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">Para Director IIEE, el alias, la REI y el permiso para crear monitoreos provienen de la plaza. El nombre escrito del colegio es solo una referencia de control. Se generará una contraseña temporal como Quispe123@@.</div>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[1550px] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-white/60"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Usuario</th><th className="px-3 py-2">Alias/correo</th><th className="px-3 py-2">Documento</th><th className="px-3 py-2">Rol</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Nombre escrito</th><th className="px-3 py-2">Colegio oficial</th><th className="px-3 py-2">Modalidad</th><th className="px-3 py-2">REI</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Detalle</th></tr></thead><tbody>{preview.map((row) => <tr key={row.source_row} className="border-t border-white/5"><td className="px-3 py-2 text-white/50">{row.source_row}</td><td className="px-3 py-2 text-white">{row.apellido_paterno} {row.apellido_materno}, {row.nombres}</td><td className="px-3 py-2 text-white/70">{row.correo}</td><td className="px-3 py-2 text-white/70">{row.numero_documento}</td><td className="px-3 py-2 text-white/70">{row.rol}</td><td className="px-3 py-2 font-mono text-white/70">{row.codigo_institucional ?? "—"}</td><td className="max-w-52 px-3 py-2 text-white/60">{row.nombre_colegio_referencia ?? "—"}</td><td className="max-w-52 px-3 py-2 text-white/70">{row.institucion_nombre ?? "—"}</td><td className="px-3 py-2 text-white/70">{row.modalidad ?? "—"}</td><td className="px-3 py-2 text-white/70">{row.rei ?? "—"}</td><td className={`px-3 py-2 font-semibold ${row.status === "invalid" ? "text-red-300" : row.warnings.length ? "text-amber-300" : "text-emerald-300"}`}>{row.status === "invalid" ? "Observado" : row.warnings.length ? "Válido con alerta" : "Válido"}</td><td className="max-w-sm px-3 py-2 text-white/55">{row.errors.join("; ") || row.warnings.join("; ") || "Listo para crear"}</td></tr>)}</tbody></table></div>
          {busy && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-white/60"><span>Creando usuarios por lotes...</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-sky-500 transition-all" style={{ width: `${progress}%` }}/></div></div>}
          <div className="mt-4 flex justify-end"><button type="button" disabled={busy || previewSummary.valid === 0} onClick={processImport} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Procesando..." : `Confirmar carga de ${previewSummary.valid} usuarios`}</button></div>
        </section>}

        {(completed || results.length > 0) && <section className="mt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-sm font-semibold text-white">3. Resumen de carga</div><div className="mt-1 text-xs text-white/50">Cada fila conserva su resultado para control y reintento.</div></div><div className="grid grid-cols-3 gap-2"><Summary label="Creados" value={resultSummary.created} tone="green"/><Summary label="Omitidos" value={resultSummary.skipped} tone="amber"/><Summary label="Errores" value={resultSummary.errors} tone="red"/></div></div>
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">Descarga y resguarda el resumen: las contraseñas temporales se muestran únicamente en este resultado y no se almacenan en la auditoría.</div>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[1250px] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-white/60"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Alias/correo</th><th className="px-3 py-2">Documento</th><th className="px-3 py-2">Contraseña temporal</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Colegio</th><th className="px-3 py-2">Modalidad</th><th className="px-3 py-2">REI</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Detalle</th></tr></thead><tbody>{results.map((row) => <tr key={row.source_row} className="border-t border-white/5"><td className="px-3 py-2 text-white/50">{row.source_row}</td><td className="px-3 py-2 text-white/75">{row.correo}</td><td className="px-3 py-2 text-white/75">{row.numero_documento}</td><td className="px-3 py-2 font-mono text-amber-100">{row.temporary_password ?? "—"}</td><td className="px-3 py-2 font-mono text-white/75">{row.codigo_institucional ?? "—"}</td><td className="max-w-52 px-3 py-2 text-white/65">{row.institucion_nombre ?? "—"}</td><td className="px-3 py-2 text-white/65">{row.modalidad ?? "—"}</td><td className="px-3 py-2 text-white/65">{row.rei ?? "—"}</td><td className={`px-3 py-2 font-semibold ${row.status === "created" ? "text-emerald-300" : row.status === "skipped" ? "text-amber-300" : "text-red-300"}`}>{row.status === "created" ? "Creado" : row.status === "skipped" ? "Omitido" : "Error"}</td><td className="px-3 py-2 text-white/55">{row.message}</td></tr>)}</tbody></table></div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void downloadUserImportResults(results, `resultado_carga_usuarios_${new Date().toISOString().slice(0,10)}.xlsx`)} className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100">Descargar resumen Excel</button>{completed && <button type="button" onClick={onClose} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Finalizar</button>}</div>
        </section>}
      </div>
    </div>
  </div>;
}

function Summary({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "green" | "amber" | "red" }) {
  const colors = { blue: "border-sky-400/20 bg-sky-500/10 text-sky-100", green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100", amber: "border-amber-400/20 bg-amber-500/10 text-amber-100", red: "border-red-400/20 bg-red-500/10 text-red-100" };
  return <div className={`min-w-20 rounded-xl border px-3 py-2 text-center ${colors[tone]}`}><div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div><div className="text-lg font-bold">{value}</div></div>;
}
