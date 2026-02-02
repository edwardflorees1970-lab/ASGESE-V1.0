import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import logoAgebreUrl from "../assets/logoagebresf.png";
import { exportFichaEscribeLmPdf } from "../lib/pdf/fichaEscribeLmPdf";
import { FICHA_ESCRIBE_LM } from "../forms/ficha_escribe_lm";
import { FICHA_LEE_LM } from "../forms/ficha_lee_lm";
import { FICHA_ORAL_LM } from "../forms/ficha_oral_lm";
import { canSeeAllRole, isAdminRole, roleLabel } from "../lib/roles";

type RunRow = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  ficha_id: string;
  institucion_educativa: string | null;
  docente: string | null;
};

type ProfileRow = {
  id: string;
  role: "admin" | "user" | string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo: string | null;
  email: string | null;
};

type FichaRow = {
  id: string;
  codigo: string;
  monitoreo_id: string;
};

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  anio: number;
  is_active: boolean;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function monthOptions() {
  return [
    { value: "ALL", label: "Todo el año" },
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];
}

function normalizeStatus(s: string) {
  return s === "submitted" ? "draft" : s;
}

function loadImageAsDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("No se pudo leer el logo"));
          reader.readAsDataURL(blob);
        })
    );
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function ReportesPage() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const isAdmin = isAdminRole(role);
  const canSeeAll = canSeeAllRole(role);

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("ALL");
  const [monitoreo, setMonitoreo] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [years, setYears] = useState<string[]>([]);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [fichas, setFichas] = useState<Record<string, FichaRow>>({});
  const [monById, setMonById] = useState<Record<string, MonitoreoRow>>({});

  // Años disponibles
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("monitoreo_catalog")
        .select("anio")
        .order("anio", { ascending: false });
      if (!alive) return;
      const uniq = Array.from(new Set((data ?? []).map((x: any) => String(x.anio))));
      setYears(uniq);
      if (uniq.length && !uniq.includes(year)) setYear(uniq[0]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Monitoreos por año
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, anio, is_active")
        .eq("anio", Number(year))
        .eq("is_active", true)
        .order("nombre", { ascending: true });
      if (!alive) return;
      setMonitoreos((data ?? []) as MonitoreoRow[]);
      if (monitoreo !== "ALL" && !(data ?? []).some((m: any) => m.codigo === monitoreo)) {
        setMonitoreo("ALL");
      }
    })();
    return () => {
      alive = false;
    };
  }, [year]);

  // Carga principal
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!user?.id) {
          setRuns([]);
          setProfiles({});
          setFichas({});
          setMonById({});
          setLoading(false);
          return;
        }

        const y = Number(year);
        const m = month === "ALL" ? null : Number(month);
        const start = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
        const end = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1);

        let fichaIds: string[] | null = null;
        if (monitoreo !== "ALL") {
          const mon = monitoreos.find((x) => x.codigo === monitoreo);
          if (mon?.id) {
            const { data: fichasData, error: fichasErr } = await supabase
              .from("ficha_catalog")
              .select("id, codigo, monitoreo_id")
              .eq("monitoreo_id", mon.id);
            if (fichasErr) throw new Error(fichasErr.message);
            fichaIds = (fichasData ?? []).map((f: any) => f.id);
          } else {
            fichaIds = [];
          }
        }

        let roleUserIds: string[] | null = null;
        if (canSeeAll && roleFilter !== "ALL") {
          const { data: roleUsers, error: roleErr } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("role", roleFilter);
          if (roleErr) throw new Error(roleErr.message);
          roleUserIds = (roleUsers ?? []).map((u: any) => u.id);
        }

        let query = supabase
          .from("ficha_run")
          .select("id, status, created_by, created_at, ficha_id, institucion_educativa, docente")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false });

        if (!canSeeAll) {
          query = query.eq("created_by", user.id);
        } else if (roleUserIds) {
          if (!roleUserIds.length) {
            if (!alive) return;
            setRuns([]);
            setProfiles({});
            setFichas({});
            setMonById({});
            setLoading(false);
            return;
          }
          query = query.in("created_by", roleUserIds);
        }

        if (status !== "ALL") {
          if (status === "draft") {
            query = query.in("status", ["draft", "submitted"]);
          } else {
            query = query.eq("status", status);
          }
        }
        if (fichaIds) {
          if (!fichaIds.length) {
            if (!alive) return;
            setRuns([]);
            setProfiles({});
            setFichas({});
            setMonById({});
            setLoading(false);
            return;
          }
          query = query.in("ficha_id", fichaIds);
        }

        const { data: runData, error: runErr } = await query;
        if (runErr) throw new Error(runErr.message);
        const runRows = (runData ?? []) as RunRow[];
        if (!alive) return;
        setRuns(runRows);

        const fichaIdSet = Array.from(new Set(runRows.map((r) => r.ficha_id)));
        if (fichaIdSet.length) {
          const { data: fData, error: fErr } = await supabase
            .from("ficha_catalog")
            .select("id, codigo, monitoreo_id")
            .in("id", fichaIdSet);
          if (fErr) throw new Error(fErr.message);
          const fMap: Record<string, FichaRow> = {};
          (fData ?? []).forEach((f: any) => (fMap[f.id] = f));
          setFichas(fMap);

          const monIdSet = Array.from(new Set((fData ?? []).map((f: any) => f.monitoreo_id)));
          if (monIdSet.length) {
            const { data: mData, error: mErr } = await supabase
              .from("monitoreo_catalog")
              .select("id, codigo, nombre, anio, is_active")
              .in("id", monIdSet);
            if (mErr) throw new Error(mErr.message);
            const mMap: Record<string, MonitoreoRow> = {};
            (mData ?? []).forEach((m: any) => (mMap[m.id] = m));
            setMonById(mMap);
          } else {
            setMonById({});
          }
        } else {
          setFichas({});
          setMonById({});
        }

        const userIds = Array.from(new Set(runRows.map((r) => r.created_by)));
        if (userIds.length) {
          const { data: pData, error: pErr } = await supabase
            .from("profiles")
            .select("id, role, nombres, apellido_paterno, apellido_materno, correo, email")
            .in("id", userIds);
          if (pErr) throw new Error(pErr.message);
          const pMap: Record<string, ProfileRow> = {};
          (pData ?? []).forEach((p: any) => (pMap[p.id] = p));
          setProfiles(pMap);
        } else {
          setProfiles({});
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudo cargar reportes.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, month, monitoreo, status, roleFilter, monitoreos, user?.id, canSeeAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const canEditOrDelete = (run: RunRow) => {
    if (isAdmin) return true;
    return run.created_by === user?.id;
  };

  const canChangeStatus = (run: RunRow) => {
    if (isAdmin) return true;
    return run.created_by === user?.id;
  };

  const exportRunPdf = async (run: RunRow) => {
    try {
      const ficha = fichas[run.ficha_id];
      const fichaCodigo = String(ficha?.codigo || "").toUpperCase();
      const meta =
        fichaCodigo === "LEE"
          ? FICHA_LEE_LM
          : fichaCodigo === "ORAL"
          ? FICHA_ORAL_LM
          : FICHA_ESCRIBE_LM;

      const { data: runDetail, error: runErr } = await supabase
        .from("ficha_run")
        .select(
          "institucion_educativa, codigo_modular, codigo_local, lugar_ie, director_monitor, docente, condicion_docente, area_monitoreo, observacion_general, compromiso, lugar, fecha, docente_firma_nombre, docente_firma_dni, monitor_firma_nombre, monitor_firma_dni"
        )
        .eq("id", run.id)
        .single();
      if (runErr) throw new Error(runErr.message);

      const { data: qData, error: qErr } = await supabase
        .from("ficha_question")
        .select("id, numero, texto, grupo, orden")
        .eq("ficha_id", run.ficha_id)
        .eq("is_active", true)
        .order("orden", { ascending: true });
      if (qErr) throw new Error(qErr.message);

      const { data: aData, error: aErr } = await supabase
        .from("ficha_answer")
        .select("question_id, yn, nivel, obs")
        .eq("run_id", run.id);
      if (aErr) throw new Error(aErr.message);

      const answers: Record<string, any> = {};
      (aData ?? []).forEach((a: any) => {
        answers[a.question_id] = {
          yn: a.yn ?? "",
          nivel: a.nivel ?? null,
          obs: a.obs ?? "",
        };
      });

      const preguntas = (qData ?? []).map((q: any) => ({
        id: q.id,
        numero: String(q.numero).padStart(2, "0"),
        texto: q.texto,
        group: q.grupo,
      }));

      const header = {
        institucion_educativa: runDetail?.institucion_educativa ?? "",
        codigo_modular: runDetail?.codigo_modular ?? "",
        codigo_local: runDetail?.codigo_local ?? "",
        lugar_ie: runDetail?.lugar_ie ?? "",
        director_monitor: runDetail?.director_monitor ?? "",
        docente: runDetail?.docente ?? "",
        condicion_docente: runDetail?.condicion_docente ?? "",
        area_monitoreo: runDetail?.area_monitoreo ?? "",
      };

      const footer = {
        observacion_general: runDetail?.observacion_general ?? "",
        compromiso: runDetail?.compromiso ?? "",
        lugar: runDetail?.lugar ?? "",
        fecha: runDetail?.fecha ?? "",
        docente_firma_nombre: runDetail?.docente_firma_nombre ?? "",
        docente_firma_dni: runDetail?.docente_firma_dni ?? "",
        monitor_firma_nombre: runDetail?.monitor_firma_nombre ?? "",
        monitor_firma_dni: runDetail?.monitor_firma_dni ?? "",
      };

      try {
        const logoDataUrl = await loadImageAsDataUrl(logoAgebreUrl);
        exportFichaEscribeLmPdf({
          titulo: meta.titulo,
          area: meta.area,
          header,
          preguntas,
          answers,
          footer,
          logoDataUrl,
        });
      } catch {
        exportFichaEscribeLmPdf({
          titulo: meta.titulo,
          area: meta.area,
          header,
          preguntas,
          answers,
          footer,
        });
      }
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo generar el PDF." });
    }
  };

  const exportExcel = () => {
    const rows: string[][] = [
      [
        "Monitoreo",
        "Ficha",
        "Fecha",
        "Estado",
        "Creador",
        "Rol creador",
        "Monitoreado",
        "Institucion",
      ],
    ];

    runs.forEach((r) => {
      const ficha = fichas[r.ficha_id];
      const mon = ficha ? monById[ficha.monitoreo_id] : null;
      const creator = profiles[r.created_by];
      const creatorName =
        [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        creator?.correo ||
        creator?.email ||
        "Usuario";
      rows.push([
        mon?.codigo || "",
        ficha?.codigo || "",
        fmtDateShort(r.created_at),
        normalizeStatus(r.status),
        creatorName,
        roleLabel(creator?.role),
        r.docente || "",
        r.institucion_educativa || "",
      ]);
    });

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`reporte_monitoreo_${stamp}.csv`, rows);
  };

  const handleEdit = (run: RunRow) => {
    const ficha = fichas[run.ficha_id];
    const mon = ficha ? monById[ficha.monitoreo_id] : null;
    if (!ficha || !mon) {
      setToast({ type: "err", msg: "No se pudo resolver la ficha para editar." });
      return;
    }
    nav(`/app/monitoreo/${mon.codigo}/ficha/${ficha.codigo}?runId=${run.id}`);
  };

  const updateStatus = async (run: RunRow, next: "draft" | "final") => {
    if (!canChangeStatus(run)) return;
    const { error } = await supabase
      .from("ficha_run")
      .update({ status: next })
      .eq("id", run.id);
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setToast({ type: "ok", msg: `Estado actualizado a ${next}.` });
    setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, status: next } : r)));
  };

  const deleteRun = async (run: RunRow) => {
    if (!canEditOrDelete(run)) return;
    const ok = window.confirm("¿Eliminar este registro?");
    if (!ok) return;
    const { error: ansErr } = await supabase.from("ficha_answer").delete().eq("run_id", run.id);
    if (ansErr) {
      setToast({ type: "err", msg: ansErr.message });
      return;
    }
    const { error } = await supabase.from("ficha_run").delete().eq("id", run.id);
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setToast({ type: "ok", msg: "Registro eliminado." });
    setRuns((prev) => prev.filter((r) => r.id !== run.id));
  };

  return (
    <div className="text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={cls(
              "rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              toast.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/30 bg-red-500/10 text-red-100"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Reportes</h1>
          <p className="mt-1 text-sm text-white/60">
            {canSeeAll
              ? "Todos los registros con filtros avanzados."
              : "Tus registros con filtros por fecha y monitoreo."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={loading || runs.length === 0}
            className={cls(
              "rounded-xl border px-4 py-2 text-sm",
              loading || runs.length === 0
                ? "border-white/10 text-white/30"
                : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
            )}
          >
            Exportar Excel (CSV)
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Año</div>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              {!years.length && <option value={year}>{year}</option>}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Mes</div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              {monthOptions().map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Monitoreo</div>
            <select
              value={monitoreo}
              onChange={(e) => setMonitoreo(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="ALL">Todos</option>
              {monitoreos.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo} - {m.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Estado</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="ALL">Todos</option>
              <option value="draft">draft</option>
              <option value="final">final</option>
            </select>
          </label>

          {canSeeAll && (
            <label className="block">
              <div className="mb-2 text-xs font-medium text-white/70">Rol creador</div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="ALL">Todos</option>
                <option value="admin">Administrador</option>
                <option value="jefe_area">Jefe de área</option>
                <option value="director">Director(a)</option>
                <option value="user">Usuario</option>
              </select>
            </label>
          )}

          <div className="flex items-end">
            <div className="text-xs text-white/50">{loading ? "Cargando..." : "Listo"}</div>
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {err}
        </div>
      )}

      {/* Lista mobile */}
      <div className="mt-5 space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            Cargando...
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            Sin registros.
          </div>
        ) : (
          runs.map((r) => {
            const ficha = fichas[r.ficha_id];
            const mon = ficha ? monById[ficha.monitoreo_id] : null;
            const creator = profiles[r.created_by];
            const statusLabel = normalizeStatus(r.status);
            const creatorName =
              [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              creator?.correo ||
              creator?.email ||
              "Usuario";

            const monitoreado = r.docente?.trim() || "-";
            const institucion = r.institucion_educativa?.trim() || "-";

            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {mon?.codigo || "MON"} / {ficha?.codigo || "FICHA"}
                  </div>
                  <div
                    className={cls(
                      "rounded-lg border px-2 py-1 text-xs",
                      statusLabel === "final"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
                        : "border-white/10 bg-white/5 badge-muted"
                    )}
                  >
                    {statusLabel}
                  </div>
                </div>
                <div className="mt-1 text-xs text-white/50">{fmtDateShort(r.created_at)}</div>
                {canSeeAll && (
                  <div className="mt-1 text-xs text-white/60">
                    <div>Por: {creatorName}</div>
                    <div className="text-white/50">Monitoreado: {monitoreado}</div>
                    <div className="text-white/50">Institucion: {institucion}</div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {canEditOrDelete(r) && (
                    <button
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                      onClick={() => handleEdit(r)}
                      disabled={!canEditOrDelete(r)}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                    onClick={() => exportRunPdf(r)}
                  >
                    PDF
                  </button>
                  {canChangeStatus(r) && (
                    <button
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                      onClick={() =>
                        updateStatus(r, normalizeStatus(r.status) === "final" ? "draft" : "final")
                      }
                      disabled={!canChangeStatus(r)}
                    >
                      {normalizeStatus(r.status) === "final" ? "Reabrir" : "Finalizar"}
                    </button>
                  )}
                  {canEditOrDelete(r) && (
                    <button
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                      onClick={() => deleteRun(r)}
                      disabled={!canEditOrDelete(r)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabla desktop */}
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-white/70">
            Total: <span className="text-white">{runs.length}</span>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs text-white/60">
                <th className="px-4 py-3">Monitoreo</th>
                <th className="px-4 py-3">Ficha</th>
                <th className="px-4 py-3">Fecha</th>
                {canSeeAll && <th className="px-4 py-3 w-64">Creador</th>}
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-white/60" colSpan={canSeeAll ? 6 : 5}>
                    Cargando...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-white/60" colSpan={canSeeAll ? 6 : 5}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                runs.map((r) => {
                  const ficha = fichas[r.ficha_id];
                  const mon = ficha ? monById[ficha.monitoreo_id] : null;
                  const creator = profiles[r.created_by];
                  const statusLabel = normalizeStatus(r.status);
                  const creatorName =
                    [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    creator?.correo ||
                    creator?.email ||
                    "Usuario";
                  const monitoreado = r.docente?.trim() || "-";
                  const institucion = r.institucion_educativa?.trim() || "-";

                  return (
                    <tr key={r.id} className="border-t border-white/10 text-sm">
                      <td className="px-4 py-3">{mon?.codigo || "-"}</td>
                      <td className="px-4 py-3">{ficha?.codigo || "-"}</td>
                      <td className="px-4 py-3 text-white/70">{fmtDateShort(r.created_at)}</td>
                      {canSeeAll && (
                        <td className="px-4 py-3 text-white/70 w-64">
                          <div className="font-medium text-white/80">{creatorName}</div>
                          <div className="text-xs text-white/50 leading-4">
                            Monitoreado: {monitoreado}
                          </div>
                          <div className="text-xs text-white/50 leading-4">
                            Institucion: {institucion}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-lg border px-2 py-1 text-xs",
                            statusLabel === "final"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
                              : "border-white/10 bg-white/5 badge-muted"
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canEditOrDelete(r) && (
                            <button
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                              onClick={() => handleEdit(r)}
                              disabled={!canEditOrDelete(r)}
                            >
                              Editar
                            </button>
                          )}
                          <button
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                            onClick={() => exportRunPdf(r)}
                          >
                            PDF
                          </button>
                          {canChangeStatus(r) && (
                            <button
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                              onClick={() =>
                                updateStatus(
                                  r,
                                  normalizeStatus(r.status) === "final" ? "draft" : "final"
                                )
                              }
                              disabled={!canChangeStatus(r)}
                            >
                              {normalizeStatus(r.status) === "final" ? "Reabrir" : "Finalizar"}
                            </button>
                          )}
                          {canEditOrDelete(r) && (
                            <button
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                              onClick={() => deleteRun(r)}
                              disabled={!canEditOrDelete(r)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
