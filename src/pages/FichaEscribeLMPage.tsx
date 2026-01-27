// src/pages/FichaEscribeLMPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  FICHA_ESCRIBE_LM,
  GROUP_LABEL,
  type NivelAvance,
  type QuestionGroup,
  type QuestionItem,
} from "../forms/ficha_escribe_lm";
import { useAuth } from "../app/AuthProvider";

type HeaderState = {
  institucion_educativa: string;

  // ✅ NUEVOS
  codigo_modular: string;
  codigo_local: string;

  lugar_ie: string;
  director_monitor: string;
  docente: string;
  condicion_docente: "NOMBRADO" | "CONTRATADO" | "";
  area_monitoreo: "COMUNICACION" | "QUECHUA" | "INGLES" | "";
};

type QuestionState = {
  yn: "SI" | "NO" | ""; // SI/NO
  nivel: NivelAvance | null; // 1/2/3 solo si SI
  obs: string; // observación por pregunta
};

type FooterState = {
  observacion_general: string;
  compromiso: string;
  lugar: string; // distrito
  fecha: string; // yyyy-mm-dd
  docente_firma_nombre: string;
  docente_firma_dni: string;
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

function groupBy<T extends { group: QuestionGroup }>(items: T[]) {
  return items.reduce<Record<QuestionGroup, T[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {
    PLANIFICACION: [],
    TEXTUALIZACION: [],
    EVALUACION: [],
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-medium text-white/70">{label}</div>
      {children}
    </label>
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

const STORAGE_PREFIX = "agebre-ficha-draft:";

export function FichaEscribeLMPage() {
  const { user, profile } = useAuth();

  // key por usuario para que no se mezclen borradores
  const draftKey = useMemo(() => {
    const uid = user?.id ?? "anon";
    return `${STORAGE_PREFIX}${FICHA_ESCRIBE_LM.key}:${uid}`;
  }, [user?.id]);

  const [header, setHeader] = useState<HeaderState>({
    institucion_educativa: "",

    // ✅ NUEVOS
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
    docente_firma_nombre: "",
    docente_firma_dni: "",
    monitor_firma_nombre: "",
    monitor_firma_dni: "",
  });

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

  // Auto-relleno del monitor (si existe profile)
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

  const getQ = (qid: string): QuestionState =>
    answers[qid] ?? { yn: "", nivel: null, obs: "" };

  const setQ = (qid: string, patch: Partial<QuestionState>) => {
    setAnswers((prev) => {
      const cur = prev[qid] ?? { yn: "", nivel: null, obs: "" };
      return { ...prev, [qid]: { ...cur, ...patch } };
    });
  };

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

  // Validación mínima: que SI obligue nivel
  const validate = () => {
    for (const q of FICHA_ESCRIBE_LM.preguntas) {
      const st = getQ(q.id);
      if (st.yn === "SI" && !st.nivel) {
        return `Falta nivel de avance (1/2/3) en la pregunta ${q.numero}.`;
      }
    }
    return null;
  };

  const submitFake = () => {
    const err = validate();
    if (err) {
      setToast({ type: "err", msg: err });
      return;
    }
    // Aquí luego lo conectamos a BD / PDF / lo que toque.
    setToast({ type: "ok", msg: "Formulario listo ✅ (luego lo persistimos en BD)" });
  };

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

  const QuestionRow = ({ q }: { q: QuestionItem }) => {
    const st = getQ(q.id);

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
              onChange={() => setQ(q.id, { yn: "SI", nivel: st.nivel ?? null })}
              label="Sí"
            />
            <RadioPill
              name={`yn-${q.id}`}
              value="NO"
              checked={st.yn === "NO"}
              onChange={() => setQ(q.id, { yn: "NO", nivel: null })}
              label="No"
            />
          </div>
        </div>

        {/* Nivel (solo si SI) */}
        {st.yn === "SI" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">Nivel:</span>

            {[1, 2, 3].map((n) => (
              <RadioPill
                key={n}
                name={`nivel-${q.id}`}
                value={String(n)}
                checked={st.nivel === n}
                onChange={() => setQ(q.id, { nivel: n as NivelAvance })}
                label={String(n)}
              />
            ))}
          </div>
        )}

        {/* Observación */}
        <div className="mt-3">
          <Field label="Observación">
            <TextArea
              value={st.obs}
              onChange={(e) => setQ(q.id, { obs: e.target.value })}
              placeholder="Escribe una observación breve y concreta..."
            />
          </Field>
        </div>
      </div>
    );
  };

  return (
    <div className="text-white">
      {/* Toast */}
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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            {FICHA_ESCRIBE_LM.titulo}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Marca Sí/No. Si marcas <b>Sí</b>, selecciona nivel (1/2/3). Agrega observación.
          </p>
        </div>

        <div className="flex gap-2">
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
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold">Encabezado</div>

        <div className="mt-4 grid gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <Field label="Institución Educativa">
              <Input
                value={header.institucion_educativa}
                onChange={(e) =>
                  setHeader((s) => ({ ...s, institucion_educativa: e.target.value }))
                }
                placeholder="Ej: I.E. 7259 Víctor Raúl Haya de la Torre"
              />
            </Field>
          </div>

          {/* ✅ NUEVOS: Código modular y local */}
          <div className="md:col-span-3">
            <Field label="Código modular">
              <Input
                value={header.codigo_modular}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    codigo_modular: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="Ej: 1234567"
                inputMode="numeric"
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
                    codigo_local: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="Ej: 012345"
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Lugar donde se encuentra la IE">
              <Input
                value={header.lugar_ie}
                onChange={(e) => setHeader((s) => ({ ...s, lugar_ie: e.target.value }))}
                placeholder="Ej: Villa El Salvador"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Director(a) o Monitor(a)">
              <Input
                value={header.director_monitor}
                onChange={(e) =>
                  setHeader((s) => ({ ...s, director_monitor: e.target.value }))
                }
                placeholder="Nombre completo"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Apellidos y nombres del(a) docente">
              <Input
                value={header.docente}
                onChange={(e) => setHeader((s) => ({ ...s, docente: e.target.value }))}
                placeholder="Nombre completo"
              />
            </Field>
          </div>

          <div className="md:col-span-6">
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

          <div className="md:col-span-6">
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
        {(["PLANIFICACION", "TEXTUALIZACION", "EVALUACION"] as const).map((g) => {
          const list = grouped[g] ?? [];
          if (!list.length) return null;

          return (
            <section key={g} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{GROUP_LABEL[g]}</div>
                <Pill>{list.length} ítems</Pill>
              </div>

              <div className="mt-4 space-y-4">
                {list.map((q) => (
                  <QuestionRow key={q.id} q={q} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Sección final */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Cierre</div>

        <div className="mt-4 grid gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <Field label="Observación general">
              <TextArea
                value={footer.observacion_general}
                onChange={(e) =>
                  setFooter((s) => ({ ...s, observacion_general: e.target.value }))
                }
                placeholder="Observación general del monitoreo..."
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Compromiso">
              <TextArea
                value={footer.compromiso}
                onChange={(e) => setFooter((s) => ({ ...s, compromiso: e.target.value }))}
                placeholder="Compromiso acordado..."
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Lugar (distrito)">
              <Input
                value={footer.lugar}
                onChange={(e) => setFooter((s) => ({ ...s, lugar: e.target.value }))}
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
                      setFooter((s) => ({ ...s, docente_firma_nombre: e.target.value }))
                    }
                    placeholder="Nombre completo"
                  />
                </Field>
                <Field label="DNI">
                  <Input
                    value={footer.docente_firma_dni}
                    onChange={(e) =>
                      setFooter((s) => ({ ...s, docente_firma_dni: e.target.value.replace(/\D/g, "") }))
                    }
                    placeholder="########"
                    inputMode="numeric"
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
                      setFooter((s) => ({ ...s, monitor_firma_nombre: e.target.value }))
                    }
                    placeholder="Nombre completo"
                  />
                </Field>
                <Field label="DNI">
                  <Input
                    value={footer.monitor_firma_dni}
                    onChange={(e) =>
                      setFooter((s) => ({ ...s, monitor_firma_dni: e.target.value.replace(/\D/g, "") }))
                    }
                    placeholder="########"
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={saveDraft}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Guardar borrador
          </button>
          <button
            onClick={submitFake}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90"
          >
            Finalizar (demo)
          </button>
        </div>

        <div className="mt-3 text-xs text-white/40">
          Nota: por ahora se guarda como borrador en <b>localStorage</b>. Luego lo conectamos a Supabase y/o PDF.
        </div>
      </div>
    </div>
  );
}
