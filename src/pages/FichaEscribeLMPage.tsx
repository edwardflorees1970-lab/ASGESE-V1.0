import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { exportFichaEscribeLmPdf } from "../lib/pdf/fichaEscribeLmPdf";
import logoAgebreUrl from "../assets/logoagebresf.png";
import {
  FICHA_ESCRIBE_LM,
  GROUP_LABEL,
  type NivelAvance,
  type QuestionItem,
  type QuestionGroup,
} from "../forms/ficha_escribe_lm";

type HeaderState = {
  institucion_educativa: string;
  codigo_modular: string;
  codigo_local: string;

  lugar_ie: string;
  director_monitor: string;
  docente: string;
  condicion_docente: "NOMBRADO" | "CONTRATADO" | "";
  area_monitoreo: "COMUNICACION" | "QUECHUA" | "INGLES" | "";
};

type QuestionState = {
  yn: "SI" | "NO" | "";
  nivel: NivelAvance | null;
  obs: string; // opcional
};

type FooterState = {
  observacion_general: string; // opcional
  compromiso: string; // opcional
  lugar: string;
  fecha: string; // yyyy-mm-dd
  docente_doc_tipo: "DNI" | "CE";
  docente_firma_nombre: string;
  docente_firma_dni: string;
  monitor_doc_tipo: "DNI" | "CE";
  monitor_firma_nombre: string;
  monitor_firma_dni: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toUpper(value: string) {
  return value.toUpperCase();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function limitDigits(value: string, max: number) {
  return onlyDigits(value).slice(0, max);
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

function groupBy<T extends { group: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});
}

const EMPTY_Q: QuestionState = { yn: "", nivel: null, obs: "" };

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  // ❗ FIX: ya NO usamos <label> envolviendo inputs (causaba salto/foco)
  return (
    <div className="block">
      <div className="mb-2 text-xs font-medium text-white/70">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-[11px] text-white/40">{hint}</div> : null}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cls(
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none",
        "placeholder:text-white/25 focus:ring-2 focus:ring-white/10",
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cls(
        "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none",
        "focus:ring-2 focus:ring-white/10",
        props.className
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      // ✅ FIX extra: evita que se “escape” el foco por bubbling raro
      onKeyDown={(e) => {
        e.stopPropagation();
        props.onKeyDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
      className={cls(
        "w-full min-h-[90px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none",
        "placeholder:text-white/25 focus:ring-2 focus:ring-white/10",
        props.className
      )}
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

function RadioPill({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={cls(
        "cursor-pointer select-none rounded-xl border px-3 py-2 text-xs transition",
        checked
          ? "border-white/30 bg-white/15 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="hidden"
      />
      {label}
    </label>
  );
}

type QuestionRowProps = {
  q: QuestionItem;
  st: QuestionState;
  onYnChange: (id: string, yn: "SI" | "NO") => void;
  onNivelChange: (id: string, nivel: NivelAvance) => void;
  onObsChange: (id: string, obs: string) => void;
};

const QuestionRow = memo(function QuestionRow({
  q,
  st,
  onYnChange,
  onNivelChange,
  onObsChange,
}: QuestionRowProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Pill>Ítem {q.numero}</Pill>
            <span className="text-xs text-white/50">({GROUP_LABEL[q.group]})</span>
          </div>
          <div className="mt-2 text-sm text-white">{q.texto}</div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <RadioPill
            name={`yn-${q.id}`}
            value="SI"
            checked={st.yn === "SI"}
            onChange={() => onYnChange(q.id, "SI")}
            label="Sí"
          />
          <RadioPill
            name={`yn-${q.id}`}
            value="NO"
            checked={st.yn === "NO"}
            onChange={() => onYnChange(q.id, "NO")}
            label="No"
          />
        </div>
      </div>

      {st.yn === "SI" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/60">Nivel:</span>
          {[1, 2, 3].map((n) => (
            <RadioPill
              key={n}
              name={`nivel-${q.id}`}
              value={String(n)}
              checked={st.nivel === n}
              onChange={() => onNivelChange(q.id, n as NivelAvance)}
              label={String(n)}
            />
          ))}
        </div>
      )}

      <div className="mt-3">
        <Field label="Observación (opcional)">
          <TextArea
            value={st.obs}
            onChange={(e) => onObsChange(q.id, e.currentTarget.value)}
            placeholder="Escribe una observación breve y concreta..."
          />
        </Field>
      </div>
    </div>
  );
});

const STORAGE_PREFIX = "agebre-ficha-draft:";

function toQKeyFromNumero(numero: string) {
  // "01" -> "P01"
  return `P${numero.padStart(2, "0")}`;
}

function qidFromQKey(qkey: string) {
  const raw = String(qkey || "").replace(/^P/i, "");
  return `p${raw.padStart(2, "0")}`; // "P01" -> "p01"
}

function normalizeStatus(s: string) {
  return s === "submitted" ? "draft" : s;
}

export function FichaEscribeLMPage() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const runId = useMemo(() => new URLSearchParams(location.search).get("runId"), [location.search]);
  const [runStatus, setRunStatus] = useState<string>("draft");
  const [loadingRun, setLoadingRun] = useState(false);
  const isAdmin = profile?.role === "admin";

  const draftKey = useMemo(() => {
    const uid = user?.id ?? "anon";
    return `${STORAGE_PREFIX}${FICHA_ESCRIBE_LM.key}:${uid}`;
  }, [user?.id]);

  const [header, setHeader] = useState<HeaderState>({
    institucion_educativa: "",
    codigo_modular: "",
    codigo_local: "",

    lugar_ie: "",
    director_monitor: "",
    docente: "",
    condicion_docente: "",
    area_monitoreo: "",
  });

  const [answers, setAnswers] = useState<Record<string, QuestionState>>({});

  const [footer, setFooter] = useState<FooterState>({
    observacion_general: "",
    compromiso: "",
    lugar: "",
    fecha: todayISO(),
    docente_doc_tipo: "DNI",
    docente_firma_nombre: "",
    docente_firma_dni: "",
    monitor_doc_tipo: "DNI",
    monitor_firma_nombre: "",
    monitor_firma_dni: "",
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(
    null
  );

  const grouped = useMemo(() => groupBy(FICHA_ESCRIBE_LM.preguntas), []);

  // Cargar borrador
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.header) setHeader(parsed.header);
      if (parsed?.answers) setAnswers(parsed.answers);
      if (parsed?.footer) setFooter(parsed.footer);
      setToast({ type: "ok", msg: "Borrador cargado ✅" });
    } catch {
      // nada
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Cargar ficha existente (modo edición)
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    (async () => {
      try {
        setLoadingRun(true);
        const { data: run, error: runErr } = await supabase
          .from("ficha_run")
          .select(
            "id, ficha_id, status, institucion_educativa, codigo_modular, codigo_local, lugar_ie, director_monitor, docente, condicion_docente, area_monitoreo, observacion_general, compromiso, lugar, fecha, docente_firma_nombre, docente_firma_dni, monitor_firma_nombre, monitor_firma_dni"
          )
          .eq("id", runId)
          .single();
        if (runErr) throw new Error(runErr.message);
        if (!alive) return;

        setRunStatus(normalizeStatus(String(run.status || "draft")));
        setHeader({
          institucion_educativa: run.institucion_educativa ?? "",
          codigo_modular: run.codigo_modular ?? "",
          codigo_local: run.codigo_local ?? "",
          lugar_ie: run.lugar_ie ?? "",
          director_monitor: run.director_monitor ?? "",
          docente: run.docente ?? "",
          condicion_docente: (run.condicion_docente ?? "") as any,
          area_monitoreo: (run.area_monitoreo ?? "") as any,
        });
        setFooter((s) => ({
          ...s,
          observacion_general: run.observacion_general ?? "",
          compromiso: run.compromiso ?? "",
          lugar: run.lugar ?? "",
          fecha: run.fecha ?? todayISO(),
          docente_firma_nombre: run.docente_firma_nombre ?? "",
          docente_firma_dni: run.docente_firma_dni ?? "",
          monitor_firma_nombre: run.monitor_firma_nombre ?? "",
          monitor_firma_dni: run.monitor_firma_dni ?? "",
        }));

        const { data: qs, error: qsErr } = await supabase
          .from("ficha_question")
          .select("id, qkey")
          .eq("ficha_id", run.ficha_id)
          .eq("is_active", true);
        if (qsErr) throw new Error(qsErr.message);
        const qIdToQid = new Map<string, string>();
        (qs ?? []).forEach((r: any) => qIdToQid.set(String(r.id), qidFromQKey(String(r.qkey))));

        const { data: ans, error: ansErr } = await supabase
          .from("ficha_answer")
          .select("question_id, yn, nivel, obs")
          .eq("run_id", runId);
        if (ansErr) throw new Error(ansErr.message);

        const nextAnswers: Record<string, QuestionState> = {};
        (ans ?? []).forEach((a: any) => {
          const qid = qIdToQid.get(String(a.question_id));
          if (!qid) return;
          nextAnswers[qid] = {
            yn: (a.yn ?? "") as any,
            nivel: a.nivel ?? null,
            obs: a.obs ?? "",
          };
        });
        if (!alive) return;
        setAnswers(nextAnswers);
      } catch (e: any) {
        if (!alive) return;
        setToast({ type: "err", msg: e?.message || "No se pudo cargar la ficha." });
      } finally {
        if (!alive) return;
        setLoadingRun(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [runId]);

  // Auto-relleno del monitor
  useEffect(() => {
    const nombre =
      [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno]
        .filter(Boolean)
        .join(" ")
        .trim();

    if (nombre && !footer.monitor_firma_nombre) {
      setFooter((s) => ({ ...s, monitor_firma_nombre: nombre }));
    }
    if (profile?.numero_documento && !footer.monitor_firma_dni) {
      setFooter((s) => ({ ...s, monitor_firma_dni: profile.numero_documento || "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile?.nombres,
    profile?.apellido_paterno,
    profile?.apellido_materno,
    profile?.numero_documento,
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const getQ = (qid: string): QuestionState => answers[qid] ?? EMPTY_Q;

  const setYn = useCallback((qid: string, yn: "SI" | "NO") => {
    setAnswers((prev) => {
      const cur = prev[qid] ?? EMPTY_Q;
      const next = {
        ...cur,
        yn,
        nivel: yn === "SI" ? (cur.nivel ?? null) : null,
      };
      return { ...prev, [qid]: next };
    });
  }, []);

  const setNivel = useCallback((qid: string, nivel: NivelAvance) => {
    setAnswers((prev) => {
      const cur = prev[qid] ?? EMPTY_Q;
      return { ...prev, [qid]: { ...cur, nivel } };
    });
  }, []);

  const setObs = useCallback((qid: string, obs: string) => {
    setAnswers((prev) => {
      const cur = prev[qid] ?? EMPTY_Q;
      return { ...prev, [qid]: { ...cur, obs: toUpper(obs) } };
    });
  }, []);

  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ header, answers, footer }));
      setToast({ type: "ok", msg: "Borrador guardado ✅" });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo guardar borrador" });
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
    setToast({ type: "ok", msg: "Borrador eliminado ✅" });
  };

  // ✅ Validación: TODO obligatorio excepto obs por pregunta, observacion_general y compromiso
  const validate = () => {
    if (!header.institucion_educativa.trim()) return "Falta Institución Educativa.";
    if (!header.codigo_modular.trim()) return "Falta Código Modular.";
    if (!header.codigo_local.trim()) return "Falta Código Local.";
    if (!header.lugar_ie.trim()) return "Falta Lugar donde se encuentra la IE.";
    if (!header.director_monitor.trim()) return "Falta Director(a) o Monitor(a).";
    if (!header.docente.trim()) return "Falta Apellidos y nombres del(a) docente.";
    if (!header.condicion_docente) return "Falta seleccionar si es nombrado o contratado.";
    if (!header.area_monitoreo) return "Falta seleccionar el área que monitorea.";

    // preguntas
    for (const q of FICHA_ESCRIBE_LM.preguntas) {
      const st = getQ(q.id);

      if (!st.yn) {
        return `Falta marcar Sí/No en la pregunta ${q.numero}.`;
      }
      if (st.yn === "SI" && !st.nivel) {
        return `Falta nivel (1/2/3) en la pregunta ${q.numero}.`;
      }
    }

    // footer obligatorio
    if (!footer.lugar.trim()) return "Falta Lugar (distrito).";
    if (!footer.fecha) return "Falta Fecha.";
    if (!footer.docente_firma_nombre.trim()) return "Falta nombre en Firma docente.";
    if (!footer.docente_firma_dni.trim()) return "Falta DNI en Firma docente.";
    if (!footer.monitor_firma_nombre.trim()) return "Falta nombre en Firma monitor.";
    if (!footer.monitor_firma_dni.trim()) return "Falta DNI en Firma monitor.";

    return null;
  };

  async function saveToDatabase() {
    const err = validate();
    if (err) {
      setToast({ type: "err", msg: err });
      return;
    }
    if (!user?.id) {
      setToast({ type: "err", msg: "No hay sesión activa. Vuelve a iniciar sesión." });
      return;
    }
    if (runId && runStatus === "final" && !isAdmin) {
      setToast({ type: "err", msg: "Solo un admin puede editar fichas en estado final." });
      return;
    }

    setSaving(true);
    try {
      // 1) obtener ficha_id: LM 2026 + ESCRIBE v1
      const { data: mon, error: monErr } = await supabase
        .from("monitoreo_catalog")
        .select("id")
        .eq("anio", 2026)
        .eq("codigo", "LM")
        .maybeSingle();

      if (monErr) throw new Error(`monitoreo_catalog: ${monErr.message}`);
      if (!mon?.id) throw new Error("No existe monitoreo LM 2026 en catálogo (seed).");

      const { data: ficha, error: fichaErr } = await supabase
        .from("ficha_catalog")
        .select("id")
        .eq("monitoreo_id", mon.id)
        .eq("codigo", "ESCRIBE")
        .eq("version", 1)
        .maybeSingle();

      if (fichaErr) throw new Error(`ficha_catalog: ${fichaErr.message}`);
      if (!ficha?.id) throw new Error("No existe ficha ESCRIBE v1 para LM 2026 (seed).");

      const fichaId = ficha.id as string;

      // 2) obtener question_id por qkey (P01..P27)
      const { data: qs, error: qsErr } = await supabase
        .from("ficha_question")
        .select("id, qkey")
        .eq("ficha_id", fichaId)
        .eq("is_active", true);

      if (qsErr) throw new Error(`ficha_question: ${qsErr.message}`);

      const qMap = new Map<string, string>();
      (qs ?? []).forEach((r: any) => qMap.set(String(r.qkey), String(r.id)));

      // Validación extra: que existan todas
      for (const q of FICHA_ESCRIBE_LM.preguntas) {
        const qkey = toQKeyFromNumero(q.numero);
        if (!qMap.get(qkey)) {
          throw new Error(`Catálogo incompleto: falta ${qkey} en ficha_question (seed).`);
        }
      }

      // 3) insertar/actualizar ficha_run
      const runPayload = {
        ficha_id: fichaId,
        created_by: user.id,

        institucion_educativa: header.institucion_educativa.trim(),
        codigo_modular: header.codigo_modular.trim(),
        codigo_local: header.codigo_local.trim(),

        lugar_ie: header.lugar_ie.trim(),
        director_monitor: header.director_monitor.trim(),
        docente: header.docente.trim(),
        condicion_docente: header.condicion_docente,
        area_monitoreo: header.area_monitoreo,

        observacion_general: (footer.observacion_general ?? "").trim(),
        compromiso: (footer.compromiso ?? "").trim(),
        lugar: footer.lugar.trim(),
        fecha: footer.fecha,

        docente_firma_nombre: footer.docente_firma_nombre.trim(),
        docente_firma_dni: footer.docente_firma_dni.trim(),
        monitor_firma_nombre: footer.monitor_firma_nombre.trim(),
        monitor_firma_dni: footer.monitor_firma_dni.trim(),

        status: runId ? normalizeStatus(runStatus) : "draft",
      };

      let runIdFinal = runId;
      if (runId) {
        const { error: runErr } = await supabase.from("ficha_run").update(runPayload).eq("id", runId);
        if (runErr) throw new Error(`ficha_run: ${runErr.message}`);
      } else {
        const { data: run, error: runErr } = await supabase
          .from("ficha_run")
          .insert(runPayload)
          .select("id")
          .single();
        if (runErr) throw new Error(`ficha_run: ${runErr.message}`);
        runIdFinal = run.id as string;
      }

      if (!runIdFinal) throw new Error("No se pudo obtener el ID del registro.");

      // 4) insertar respuestas
      const answerRows = FICHA_ESCRIBE_LM.preguntas.map((q) => {
        const st = getQ(q.id);
        const qkey = toQKeyFromNumero(q.numero);
        const questionId = qMap.get(qkey)!;

        return {
          run_id: runIdFinal,
          question_id: questionId,
          yn: st.yn,
          nivel: st.yn === "SI" ? st.nivel : null,
          obs: (st.obs ?? "").trim(), // opcional
        };
      });

      const { error: ansErr } = await supabase
        .from("ficha_answer")
        .upsert(answerRows, { onConflict: "run_id,question_id" });
      if (ansErr) throw new Error(`ficha_answer: ${ansErr.message}`);

      // 5) PDF + listo
      try {
        const logoDataUrl = await loadImageAsDataUrl(logoAgebreUrl);
        exportFichaEscribeLmPdf({
          titulo: FICHA_ESCRIBE_LM.titulo,
          area: FICHA_ESCRIBE_LM.area,
          header,
          preguntas: FICHA_ESCRIBE_LM.preguntas,
          answers,
          footer,
          logoDataUrl,
        });
        setToast({ type: "ok", msg: "Guardado en base de datos y PDF generado ✅" });
      } catch (pdfErr: any) {
        exportFichaEscribeLmPdf({
          titulo: FICHA_ESCRIBE_LM.titulo,
          area: FICHA_ESCRIBE_LM.area,
          header,
          preguntas: FICHA_ESCRIBE_LM.preguntas,
          answers,
          footer,
        });
        setToast({
          type: "err",
          msg: "Guardado en BD, pero no se pudo cargar el logo para el PDF.",
        });
      }

      localStorage.removeItem(draftKey);
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  const NivelInfo = () => (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">Nivel de avance</div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {FICHA_ESCRIBE_LM.encabezado.nivel_avance_info.map((x) => (
          <div key={x.nivel} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Nivel</div>
            <div className="mt-1 text-lg font-semibold">{x.nivel}</div>
            <div className="mt-2 text-xs text-white/70">{x.descripcion}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render dinámico de grupos en orden fijo
  const GROUP_ORDER: QuestionGroup[] = ["PLANIFICACION", "TEXTUALIZACION", "REVISION", "EVALUACION"];
  const [openSections, setOpenSections] = useState<Record<QuestionGroup, boolean>>({
    PLANIFICACION: true,
    TEXTUALIZACION: true,
    REVISION: true,
    EVALUACION: true,
  });

  const toggleSection = (g: QuestionGroup) => {
    setOpenSections((s) => ({ ...s, [g]: !s[g] }));
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

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            {FICHA_ESCRIBE_LM.titulo}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Marca Sí/No. Si marcas <b>Sí</b>, selecciona nivel (1/2/3). Observaciones opcionales.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            onClick={saveDraft}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Guardar borrador
          </button>
          <button
            onClick={clearDraft}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 hover:bg-red-500/20"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Encabezado */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="text-sm font-semibold">Encabezado</div>

        <div className="mt-4 grid gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <Field label="Institución Educativa">
              <Input
                value={header.institucion_educativa}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    institucion_educativa: toUpper(e.target.value),
                  }))
                }
                placeholder="Ej: I.E. 7259 Víctor Raúl Haya de la Torre"
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Código modular">
              <Input
                value={header.codigo_modular}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    codigo_modular: limitDigits(e.target.value, 7),
                  }))
                }
                inputMode="numeric"
                pattern="\\d*"
                maxLength={7}
                placeholder="########"
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Código local">
              <Input
                value={header.codigo_local}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    codigo_local: limitDigits(e.target.value, 6),
                  }))
                }
                inputMode="numeric"
                pattern="\\d*"
                maxLength={6}
                placeholder="########"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Lugar donde se encuentra la IE">
              <Input
                value={header.lugar_ie}
                onChange={(e) =>
                  setHeader((s) => ({ ...s, lugar_ie: toUpper(e.target.value) }))
                }
                placeholder="Ej: Villa El Salvador"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Director(a) o Monitor(a)">
              <Input
                value={header.director_monitor}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    director_monitor: toUpper(e.target.value),
                  }))
                }
                placeholder="Nombre completo"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Apellidos y nombres del(a) docente">
              <Input
                value={header.docente}
                onChange={(e) =>
                  setHeader((s) => ({ ...s, docente: toUpper(e.target.value) }))
                }
                placeholder="Nombre completo"
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Nombrado o contratado">
              <Select
                value={header.condicion_docente}
                onChange={(e) =>
                  setHeader((s) => ({ ...s, condicion_docente: e.target.value as any }))
                }
              >
                <option value="">Seleccionar...</option>
                <option value="NOMBRADO">Nombrado</option>
                <option value="CONTRATADO">Contratado</option>
              </Select>
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Área que monitorea">
              <Select
                value={header.area_monitoreo}
                onChange={(e) =>
                  setHeader((s) => ({ ...s, area_monitoreo: e.target.value as any }))
                }
              >
                <option value="">Seleccionar...</option>
                <option value="COMUNICACION">Comunicación</option>
                <option value="QUECHUA">Quechua</option>
                <option value="INGLES">Inglés</option>
              </Select>
            </Field>
          </div>
        </div>

        <NivelInfo />
      </div>

      {/* Preguntas por secciones */}
      <div className="mt-6 space-y-6">
        {GROUP_ORDER.map((g) => {
          const list = (grouped[g] ?? []) as QuestionItem[];
          if (!list.length) return null;

          return (
            <section key={g} className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <button
                type="button"
                onClick={() => toggleSection(g)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={!!openSections[g]}
              >
                <div className="text-lg font-semibold">{GROUP_LABEL[g]}</div>
                <div className="flex items-center gap-2">
                  <Pill>{list.length} ítems</Pill>
                  <span className="text-xs text-white/60">
                    {openSections[g] ? "Ocultar" : "Mostrar"}
                  </span>
                </div>
              </button>

              {openSections[g] && (
                <div className="mt-4 space-y-4">
                  {list.map((q) => {
                    const st = getQ(q.id);
                    return (
                      <QuestionRow
                        key={q.id}
                        q={q}
                        st={st}
                        onYnChange={setYn}
                        onNivelChange={setNivel}
                        onObsChange={setObs}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Cierre */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="text-lg font-semibold">Cierre</div>

        <div className="mt-4 grid gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <Field label="Observación general (opcional)">
              <TextArea
                value={footer.observacion_general}
                onChange={(e) =>
                  setFooter((s) => ({
                    ...s,
                    observacion_general: toUpper(e.target.value),
                  }))
                }
                placeholder="Observación general del monitoreo..."
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Compromiso (opcional)">
              <TextArea
                value={footer.compromiso}
                onChange={(e) =>
                  setFooter((s) => ({ ...s, compromiso: toUpper(e.target.value) }))
                }
                placeholder="Compromiso acordado..."
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Lugar (distrito)">
              <Input
                value={footer.lugar}
                onChange={(e) =>
                  setFooter((s) => ({ ...s, lugar: toUpper(e.target.value) }))
                }
                placeholder="Ej: Villa El Salvador"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Fecha">
              <Input
                type="date"
                value={footer.fecha}
                onChange={(e) => setFooter((s) => ({ ...s, fecha: e.target.value }))}
              />
            </Field>
          </div>

          {/* Firmas */}
          <div className="md:col-span-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">Firma docente monitoreado</div>
              <div className="mt-3 grid gap-3">
                <Field label="Nombre">
                  <Input
                    value={footer.docente_firma_nombre}
                    onChange={(e) =>
                      setFooter((s) => ({
                        ...s,
                        docente_firma_nombre: toUpper(e.target.value),
                      }))
                    }
                    placeholder="Nombre completo"
                  />
                </Field>
                <Field label="Documento">
                  <Select
                    value={footer.docente_doc_tipo}
                    onChange={(e) =>
                      setFooter((s) => ({
                        ...s,
                        docente_doc_tipo: e.target.value as "DNI" | "CE",
                        docente_firma_dni: limitDigits(
                          s.docente_firma_dni,
                          e.target.value === "DNI" ? 8 : 9
                        ),
                      }))
                    }
                  >
                    <option value="DNI">DNI (8)</option>
                    <option value="CE">CE (9)</option>
                  </Select>
                </Field>
                <Field label={`Número (${footer.docente_doc_tipo})`}>
                  <Input
                    value={footer.docente_firma_dni}
                    onChange={(e) =>
                      setFooter((s) => ({
                        ...s,
                        docente_firma_dni: limitDigits(
                          e.target.value,
                          s.docente_doc_tipo === "DNI" ? 8 : 9
                        ),
                      }))
                    }
                    inputMode="numeric"
                    pattern="\\d*"
                    maxLength={footer.docente_doc_tipo === "DNI" ? 8 : 9}
                    placeholder="########"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="md:col-span-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">Firma monitor</div>
              <div className="mt-3 grid gap-3">
                <Field label="Nombre">
                  <Input
                    value={footer.monitor_firma_nombre}
                    onChange={(e) =>
                      setFooter((s) => ({
                        ...s,
                        monitor_firma_nombre: toUpper(e.target.value),
                      }))
                    }
                    placeholder="Nombre completo"
                  />
                </Field>
                <Field label="Documento">
                  <Select
                    value={footer.monitor_doc_tipo}
                    onChange={(e) =>
                      setFooter((s) => ({
                        ...s,
                        monitor_doc_tipo: e.target.value as "DNI" | "CE",
                        monitor_firma_dni: limitDigits(
                          s.monitor_firma_dni,
                          e.target.value === "DNI" ? 8 : 9
                        ),
                      }))
                    }
                  >
                    <option value="DNI">DNI (8)</option>
                    <option value="CE">CE (9)</option>
                  </Select>
                </Field>
                <Field label={`Número (${footer.monitor_doc_tipo})`}>
                  <Input
                    value={footer.monitor_firma_dni}
                    onChange={(e) =>
                      setFooter((s) => ({
                        ...s,
                        monitor_firma_dni: limitDigits(
                          e.target.value,
                          s.monitor_doc_tipo === "DNI" ? 8 : 9
                        ),
                      }))
                    }
                    inputMode="numeric"
                    pattern="\\d*"
                    maxLength={footer.monitor_doc_tipo === "DNI" ? 8 : 9}
                    placeholder="########"
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/60">
            {runId ? `Estado actual: ${runStatus}` : "Nuevo registro"}
            {loadingRun && " · Cargando..."}
          </div>
          {runId && runStatus === "final" && !isAdmin && (
            <div className="text-xs text-red-200/80">
              Solo un admin puede editar o eliminar fichas en estado final.
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={saveDraft}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Guardar borrador
          </button>

          <button
            onClick={saveToDatabase}
            disabled={saving || loadingRun || (!!runId && runStatus === "final" && !isAdmin)}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              saving || loadingRun || (runId && runStatus === "final" && !isAdmin)
                ? "bg-white/40 text-zinc-950 cursor-not-allowed"
                : "bg-white text-zinc-950 hover:bg-white/90"
            )}
          >
            {saving ? "Guardando..." : runId ? "Actualizar en BD" : "Guardar en BD"}
          </button>
        </div>

        <div className="mt-3 text-xs text-white/40">
          Se guardará en <b>ficha_run</b> + <b>ficha_answer</b>.
        </div>
      </div>
    </div>
  );
}
