import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { daysFromToday } from "./monitoreoVigencia";

// ---------- Tipos ----------

export type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  is_active: boolean;
};

export type Especialista = { user_id: string; nombre: string; rei: string | null; meta: number | null };

export type Ficha = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  institucion_id: string | null;
  ie_nombre: string | null;
  codigo_modular: string | null;
  rei: string | null;
  nivel: string | null;
  distrito: string | null;
  fecha_aplicacion: string | null;
  template_codigo: string | null;
  firmado: boolean;
};

export type CoberturaRei = { rei: string; total: number; visitadas: number };

export type SeguimientoData = {
  monitoreo: { id: string; codigo: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null } | null;
  especialistas: Especialista[];
  fichas: Ficha[];
  cobertura: CoberturaRei[];
};

export type Compromiso = {
  id: string;
  monitoreo_id: string;
  institucion_id: string | null;
  form_run_id: string | null;
  descripcion: string;
  responsable: string | null;
  fecha_limite: string | null;
  estado: "pendiente" | "cumplido" | "anulado";
  nota_cierre: string | null;
  created_by: string;
  created_at: string;
  cerrado_at: string | null;
};

export type IePadron = {
  id: string;
  nombre: string;
  cm: string | null;
  cl: string | null;
  nivel: string | null;
  rei: string | null;
  distrito: string | null;
  gestion: string | null;
  director: string | null;
  telefono: string | null;
};

export type Toast = { type: "ok" | "err"; msg: string };

// ---------- Utilidades ----------

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
};

export const dateOnlyLima = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });

export const daysSince = (iso?: string | null) => {
  if (!iso) return null;
  const d = daysFromToday(dateOnlyLima(iso));
  return d == null ? null : -d;
};

export const fmtNum = (n: number, digits = 1) =>
  n.toLocaleString("es-PE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Texto para buscar sin distinguir mayusculas ni tildes. */
export const normalize = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const fichaUrl = (m: MonitoreoRow | null, f: Ficha, returnTo: string) =>
  m && f.template_codigo
    ? `/app/monitoreo/${m.codigo}/ficha/${f.template_codigo}?runId=${f.id}&mid=${encodeURIComponent(m.id)}&returnTo=${returnTo}`
    : null;

// ---------- Datos ----------

const STORAGE_KEY = "asgese.seguimiento.monitoreo";

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Monitoreos del modo actual, datos de seguimiento y compromisos del monitoreo elegido.
 *  El monitoreo elegido se recuerda entre las dos vistas de Seguimiento. */
export function useSeguimiento(isTestMode: boolean) {
  const [loading, setLoading] = useState(true);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);
  const [monitoreoId, setMonitoreoIdState] = useState("");
  const [data, setData] = useState<SeguimientoData | null>(null);
  const [loadedId, setLoadedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const setMonitoreoId = useCallback((id: string) => {
    setMonitoreoIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* sin almacenamiento: solo no se recuerda */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: rows, error: err } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, fecha_inicio, fecha_fin, is_active")
        .eq("is_test", isTestMode)
        .order("is_active", { ascending: false })
        .order("fecha_inicio", { ascending: false, nullsFirst: false });
      if (!alive) return;
      if (err) setError(err.message);
      const list = (rows ?? []) as MonitoreoRow[];
      const stored = readStored();
      setMonitoreos(list);
      setMonitoreoIdState((prev) => {
        if (prev && list.some((m) => m.id === prev)) return prev;
        if (stored && list.some((m) => m.id === stored)) return stored;
        return list[0]?.id ?? "";
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isTestMode]);

  const loadCompromisos = useCallback(async (mid: string) => {
    const { data: rows, error: err } = await supabase
      .from("monitoreo_compromiso")
      .select("id, monitoreo_id, institucion_id, form_run_id, descripcion, responsable, fecha_limite, estado, nota_cierre, created_by, created_at, cerrado_at")
      .eq("monitoreo_id", mid)
      .order("created_at", { ascending: false });
    if (err) {
      setToast({ type: "err", msg: err.message });
      return;
    }
    setCompromisos((rows ?? []) as Compromiso[]);
  }, []);

  useEffect(() => {
    if (!monitoreoId) return;
    let alive = true;
    (async () => {
      const [{ data: payload, error: err }] = await Promise.all([
        supabase.rpc("seguimiento_monitoreo", { p_monitoreo_id: monitoreoId }),
        loadCompromisos(monitoreoId),
      ]);
      if (!alive) return;
      setError(err ? err.message : null);
      setData(err ? null : (payload as SeguimientoData));
      setLoadedId(monitoreoId);
    })();
    return () => {
      alive = false;
    };
  }, [monitoreoId, loadCompromisos]);

  const selected = monitoreos.find((m) => m.id === monitoreoId) ?? null;

  return {
    loading,
    monitoreos,
    monitoreoId,
    setMonitoreoId,
    selected,
    data,
    loadingData: loadedId !== monitoreoId,
    error,
    compromisos,
    reloadCompromisos: loadCompromisos,
    toast,
    setToast,
  };
}

let padronCache: IePadron[] | null = null;

/** Padron de IE de la UGEL (se pide una vez por sesion). */
export function usePadronIe() {
  const [padron, setPadron] = useState<IePadron[] | null>(padronCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (padronCache) return;
    let alive = true;
    (async () => {
      const { data, error: err } = await supabase.rpc("seguimiento_padron_ie");
      if (!alive) return;
      if (err) {
        setError(err.message);
        return;
      }
      padronCache = (data ?? []) as IePadron[];
      setPadron(padronCache);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { padron, error };
}
