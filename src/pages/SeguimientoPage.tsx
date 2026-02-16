import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole } from "../lib/roles";

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  solicitud_id?: string | null;
};

type ProfileRow = {
  id: string;
  role: string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo: string | null;
  email: string | null;
  rei: string | null;
};

type IeRow = {
  id: string;
  nombre: string;
  codigo_modular: string | null;
  codigo_local: string | null;
  rei: string | null;
  nivel?: { nombre: string } | null;
};

type AsigRow = {
  id: string;
  institucion_id: string;
  user_id: string;
};

type ActividadRow = {
  id: string;
  titulo: string;
  obligatorio: boolean;
};

type ExtraActividadRow = {
  id: string;
  titulo: string;
};

type AvanceRow = {
  id: string;
  institucion_id: string;
  user_id: string;
  actividad_id: string;
  tipo_actividad: "global" | "extra";
  realizado: boolean;
  evidencia_url: string | null;
};

type ValidacionRow = {
  id: string;
  institucion_id: string;
  user_id: string;
  porcentaje: number;
  comentario: string | null;
  validado_at: string;
};

function displayName(p?: ProfileRow | null) {
  if (!p) return "Usuario";
  return (
    [p.apellido_paterno, p.apellido_materno, p.nombres].filter(Boolean).join(" ").trim() ||
    p.correo ||
    p.email ||
    "Usuario"
  );
}

export function SeguimientoPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canManage = canSeeAllRole(role);

  const [loading, setLoading] = useState(true);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);
  const [monitoreoId, setMonitoreoId] = useState<string>("");

  const [monitores, setMonitores] = useState<ProfileRow[]>([]);
  const [ies, setIes] = useState<IeRow[]>([]);
  const [assignedIes, setAssignedIes] = useState<IeRow[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsigRow[]>([]);

  const [actividades, setActividades] = useState<ActividadRow[]>([]);
  const [actividadTitle, setActividadTitle] = useState("");
  const [actividadOblig, setActividadOblig] = useState(true);
  const [cddFlag, setCddFlag] = useState(false);
  const [extras, setExtras] = useState<ExtraActividadRow[]>([]);
  const [avances, setAvances] = useState<AvanceRow[]>([]);
  const [validaciones, setValidaciones] = useState<ValidacionRow[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [selectedIe, setSelectedIe] = useState<string>("");
  const [selectedMonitor, setSelectedMonitor] = useState<string>("");
  const [iePickerSearch, setIePickerSearch] = useState("");
  const [extraTitle, setExtraTitle] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [busyAssign, setBusyAssign] = useState(false);
  const [busyAuto, setBusyAuto] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [validateIe, setValidateIe] = useState<IeRow | null>(null);
  const [validateMonitor, setValidateMonitor] = useState<ProfileRow | null>(null);
  const [validatePct, setValidatePct] = useState(0);
  const [validateComment, setValidateComment] = useState("");
  const [ieSearch, setIeSearch] = useState("");
  const [iePage, setIePage] = useState(1);
  const [iePageSize, setIePageSize] = useState(20);
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorOnlyZeroValidated, setMonitorOnlyZeroValidated] = useState(false);
  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorPageSize, setMonitorPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canManage && !profile?.id) return;

      if (canManage) {
        const { data } = await supabase
          .from("monitoreo_catalog")
          .select("id, codigo, nombre, solicitud_id")
          .eq("is_active", true)
          .order("nombre", { ascending: true });
        if (!alive) return;
        setMonitoreos((data ?? []) as MonitoreoRow[]);
        if (!monitoreoId && data?.length) setMonitoreoId(data[0].id);
        return;
      }

      const { data: asigRows } = await supabase
        .from("monitoreo_asignacion")
        .select("monitoreo_id")
        .eq("user_id", profile?.id);
      const ids = (asigRows ?? []).map((r: any) => r.monitoreo_id);
      if (!alive) return;
      if (!ids.length) {
        setMonitoreos([]);
        setMonitoreoId("");
        return;
      }
      const { data } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, solicitud_id")
        .in("id", ids)
        .eq("is_active", true)
        .order("nombre", { ascending: true });
      if (!alive) return;
      setMonitoreos((data ?? []) as MonitoreoRow[]);
      if (!monitoreoId && data?.length) setMonitoreoId(data[0].id);
    })();
    return () => {
      alive = false;
    };
  }, [canManage, profile?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!monitoreoId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setSelectedIe("");
        setSelectedMonitor("");
        setIePickerSearch("");
        setIeSearch("");
        setIePage(1);
        setMonitorSearch("");
        setMonitorOnlyZeroValidated(false);
        setMonitorPage(1);
        const { data: monData } = await supabase
          .from("monitoreo_catalog")
          .select("id, codigo, nombre, solicitud_id")
          .eq("id", monitoreoId)
          .maybeSingle();
        const solicitudId = (monData as any)?.solicitud_id as string | undefined;
        let cddLocal = false;
        if (solicitudId) {
          const { data: solRow } = await supabase
            .from("monitoreo_solicitud")
            .select("cdd")
            .eq("id", solicitudId)
            .maybeSingle();
          cddLocal = !!(solRow as any)?.cdd;
          setCddFlag(cddLocal);
        } else {
          cddLocal = false;
          setCddFlag(false);
        }

        // Monitores asignados al monitoreo
        const { data: asigUsers } = await supabase
          .from("monitoreo_asignacion")
          .select("user_id")
          .eq("monitoreo_id", monitoreoId);
        const userIds = (asigUsers ?? []).map((r: any) => r.user_id);
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, role, nombres, apellido_paterno, apellido_materno, correo, email, rei")
            .in("id", userIds);
          const filtered = (profiles ?? []).filter((p: any) => p.role !== "admin");
          setMonitores(filtered as ProfileRow[]);
        } else {
          setMonitores([]);
        }

        // IE disponibles
        if (canManage && solicitudId) {
          const { data: ieRows } = await supabase
            .from("monitoreo_solicitud_ie")
            .select(
              "institucion_id, institucion_educativa!inner(id, nombre, codigo_modular, codigo_local, rei, nivel:cat_nivel(nombre))"
            )
            .eq("solicitud_id", solicitudId);
          const list = (ieRows ?? []).map((r: any) => r.institucion_educativa);
          setIes((list ?? []) as IeRow[]);
        } else if (!canManage && profile?.id) {
          const { data: ieRows } = await supabase
            .from("monitoreo_ie_asignacion")
            .select(
              "institucion_id, institucion_educativa!inner(id, nombre, codigo_modular, codigo_local, rei, nivel:cat_nivel(nombre))"
            )
            .eq("monitoreo_id", monitoreoId)
            .eq("user_id", profile.id);
          const list = (ieRows ?? []).map((r: any) => r.institucion_educativa);
          setIes((list ?? []) as IeRow[]);
        } else {
          setIes([]);
        }

        const { data: asigIe } = await supabase
          .from("monitoreo_ie_asignacion")
          .select("id, institucion_id, user_id")
          .eq("monitoreo_id", monitoreoId);
        setAsignaciones((asigIe ?? []) as AsigRow[]);
        const { data: asigIeDetail } = await supabase
          .from("monitoreo_ie_asignacion")
          .select(
            "institucion_id, institucion_educativa!inner(id, nombre, codigo_modular, codigo_local, rei, nivel:cat_nivel(nombre))"
          )
          .eq("monitoreo_id", monitoreoId);
        const assignedList = (asigIeDetail ?? []).map((r: any) => r.institucion_educativa);
        setAssignedIes((assignedList ?? []) as IeRow[]);

        const { data: actRows } = await supabase
          .from("monitoreo_actividad")
          .select("id, titulo, obligatorio")
          .eq("monitoreo_id", monitoreoId)
          .eq("is_active", true)
          .order("orden", { ascending: true });
        setActividades((actRows ?? []) as ActividadRow[]);

        if (solicitudId && cddLocal) {
          const already = (actRows ?? []).some(
            (a: any) => (a.titulo || "").toLowerCase() === "subido a la plataforma simon"
          );
          if (!already) {
            const { data: simonRow } = await supabase
              .from("monitoreo_actividad")
              .insert({
                monitoreo_id: monitoreoId,
                titulo: "Subido a la plataforma SIMON",
                obligatorio: true,
                orden: (actRows?.length ?? 0) + 1,
              })
              .select("id, titulo, obligatorio")
              .single();
            if (simonRow) {
              setActividades((prev) => [...prev, simonRow as ActividadRow]);
            }
          }
        }

        if (profile?.id) {
          const { data: extraRows } = await supabase
            .from("monitoreo_actividad_extra")
            .select("id, titulo")
            .eq("monitoreo_id", monitoreoId)
            .eq("created_by", profile.id)
            .eq("is_active", true);
          setExtras((extraRows ?? []) as ExtraActividadRow[]);
        }

        // detalles pesados se cargan luego
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [monitoreoId, profile?.id]);

  useEffect(() => {
    if (!monitoreoId) return;
    let alive = true;
    (async () => {
      try {
        setLoadingDetails(true);
        const { data: advRows } = await supabase
          .from("monitoreo_ie_avance")
          .select("id, institucion_id, user_id, actividad_id, tipo_actividad, realizado, evidencia_url")
          .eq("monitoreo_id", monitoreoId);
        if (!alive) return;
        setAvances((advRows ?? []) as AvanceRow[]);

        const { data: valRows } = await supabase
          .from("monitoreo_ie_validacion")
          .select("id, institucion_id, user_id, porcentaje, comentario, validado_at")
          .eq("monitoreo_id", monitoreoId);
        if (!alive) return;
        setValidaciones((valRows ?? []) as ValidacionRow[]);
      } finally {
        if (!alive) return;
        setLoadingDetails(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [monitoreoId]);

  const asigByIe = useMemo(() => {
    const map: Record<string, AsigRow> = {};
    asignaciones.forEach((a) => (map[a.institucion_id] = a));
    return map;
  }, [asignaciones]);

  const monitoresById = useMemo(() => {
    const map: Record<string, ProfileRow> = {};
    monitores.forEach((m) => (map[m.id] = m));
    return map;
  }, [monitores]);

  const requiredActIds = useMemo(
    () => new Set(actividades.filter((a) => a.obligatorio).map((a) => a.id)),
    [actividades]
  );

  const progressByIe = useMemo(() => {
    const total = requiredActIds.size || 1;
    const map: Record<string, number> = {};
    asignaciones.forEach((asig) => {
      const done = avances.filter(
        (a) =>
          a.institucion_id === asig.institucion_id &&
          a.user_id === asig.user_id &&
          a.tipo_actividad === "global" &&
          a.realizado &&
          requiredActIds.has(a.actividad_id)
      ).length;
      map[asig.institucion_id] = Math.round((done / total) * 100);
    });
    return map;
  }, [asignaciones, avances, requiredActIds]);

  const latestValidByIe = useMemo(() => {
    const map: Record<string, ValidacionRow> = {};
    validaciones.forEach((v) => {
      const prev = map[v.institucion_id];
      if (!prev || new Date(v.validado_at).getTime() > new Date(prev.validado_at).getTime()) {
        map[v.institucion_id] = v;
      }
    });
    return map;
  }, [validaciones]);

  const myAssignedIes = useMemo(() => {
    if (!profile?.id) return [];
    return ies.filter((ie) => asigByIe[ie.id]?.user_id === profile.id);
  }, [ies, asigByIe, profile?.id]);

  const filteredIes = useMemo(() => {
    const term = ieSearch.trim().toLowerCase();
    if (!term) return assignedIes;
    return assignedIes.filter((ie) => {
      const name = ie.nombre?.toLowerCase() || "";
      const cod = ie.codigo_modular?.toLowerCase() || "";
      return name.includes(term) || cod.includes(term);
    });
  }, [assignedIes, ieSearch]);

  const iePickerOptions = useMemo(() => {
    const term = iePickerSearch.trim().toLowerCase();
    if (!term) return ies;
    return ies.filter((ie) => {
      const name = ie.nombre?.toLowerCase() || "";
      const cod = ie.codigo_modular?.toLowerCase() || "";
      return name.includes(term) || cod.includes(term);
    });
  }, [ies, iePickerSearch]);

  const iePickerLabel = (ie: IeRow) => {
    const nivel = ie.nivel?.nombre ? ` • ${ie.nivel.nombre}` : "";
    const rei = ie.rei ? ` • REI ${ie.rei}` : " • REI SIN";
    return `${ie.nombre} (${ie.codigo_modular || "-"})${nivel}${rei}`;
  };

  const totalPages = Math.max(1, Math.ceil(filteredIes.length / iePageSize));
  const pageIes = filteredIes.slice((iePage - 1) * iePageSize, iePage * iePageSize);

  const monitorSummaryRows = useMemo(() => {
    return monitores.map((m) => {
      const iesMonitor = ies.filter((ie) => asigByIe[ie.id]?.user_id === m.id);
      const latestValByIe: Record<string, ValidacionRow> = {};
      validaciones.forEach((v) => {
        if (v.user_id !== m.id) return;
        const prev = latestValByIe[v.institucion_id];
        if (!prev || new Date(v.validado_at).getTime() > new Date(prev.validado_at).getTime()) {
          latestValByIe[v.institucion_id] = v;
        }
      });
      const validatedIes = iesMonitor.filter((ie) => Boolean(latestValByIe[ie.id]));
      const pendingIes = iesMonitor.filter((ie) => !latestValByIe[ie.id]);
      const avgValidated =
        validatedIes.length === 0
          ? 0
          : Math.round(
              validatedIes.reduce(
                (acc, ie) => acc + (latestValByIe[ie.id]?.porcentaje ?? 0),
                0
              ) / validatedIes.length
            );
      const avgPendingValidation =
        pendingIes.length === 0
          ? 0
          : Math.round(
              pendingIes.reduce((acc, ie) => acc + (progressByIe[ie.id] ?? 0), 0) /
                pendingIes.length
            );
      return {
        monitor: m,
        assignedCount: iesMonitor.length,
        validatedCount: validatedIes.length,
        pendingCount: pendingIes.length,
        avgValidated,
        avgPendingValidation,
      };
    });
  }, [monitores, ies, asigByIe, validaciones, progressByIe]);

  const filteredMonitorRows = useMemo(() => {
    const term = monitorSearch.trim().toLowerCase();
    return monitorSummaryRows.filter((row) => {
      if (monitorOnlyZeroValidated && row.avgValidated !== 0) return false;
      if (!term) return true;
      const name = displayName(row.monitor).toLowerCase();
      const rei = (row.monitor.rei || "").toLowerCase();
      return name.includes(term) || rei.includes(term);
    });
  }, [monitorSummaryRows, monitorSearch, monitorOnlyZeroValidated]);

  const monitorTotalPages = Math.max(1, Math.ceil(filteredMonitorRows.length / monitorPageSize));
  const pageMonitorRows = filteredMonitorRows.slice(
    (monitorPage - 1) * monitorPageSize,
    monitorPage * monitorPageSize
  );

  const toggleAvance = async (ieId: string, actId: string, tipo: "global" | "extra") => {
    if (!profile?.id) return;
    const existing = avances.find(
      (a) =>
        a.institucion_id === ieId &&
        a.user_id === profile.id &&
        a.actividad_id === actId &&
        a.tipo_actividad === tipo
    );
    if (existing) {
      const next = !existing.realizado;
      const { error } = await supabase
        .from("monitoreo_ie_avance")
        .update({ realizado: next, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        setToast({ type: "err", msg: error.message });
        return;
      }
      setAvances((prev) =>
        prev.map((a) => (a.id === existing.id ? { ...a, realizado: next } : a))
      );
      return;
    }
    const { data, error } = await supabase
      .from("monitoreo_ie_avance")
      .insert({
        monitoreo_id: monitoreoId,
        institucion_id: ieId,
        user_id: profile.id,
        actividad_id: actId,
        tipo_actividad: tipo,
        realizado: true,
      })
      .select("id, institucion_id, user_id, actividad_id, tipo_actividad, realizado, evidencia_url")
      .single();
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setAvances((prev) => [...prev, data as AvanceRow]);
  };

  const handleAssign = async () => {
    if (!selectedIe || !selectedMonitor) return;
    setBusyAssign(true);
    const existing = asignaciones.find((a) => a.institucion_id === selectedIe);
    const { error } = existing
      ? await supabase
          .from("monitoreo_ie_asignacion")
          .update({ user_id: selectedMonitor, asignado_by: profile?.id ?? null })
          .eq("id", existing.id)
      : await supabase.from("monitoreo_ie_asignacion").insert({
          monitoreo_id: monitoreoId,
          institucion_id: selectedIe,
          user_id: selectedMonitor,
          asignado_by: profile?.id ?? null,
        });
    if (error) {
      setToast({ type: "err", msg: error.message });
      setBusyAssign(false);
      return;
    }
    const { data: asigIe } = await supabase
      .from("monitoreo_ie_asignacion")
      .select("id, institucion_id, user_id")
      .eq("monitoreo_id", monitoreoId);
    setAsignaciones((asigIe ?? []) as AsigRow[]);
    const { data: asigIeDetail } = await supabase
      .from("monitoreo_ie_asignacion")
      .select("institucion_id, institucion_educativa!inner(id, nombre, codigo_modular, codigo_local, rei)")
      .eq("monitoreo_id", monitoreoId);
    const assignedList = (asigIeDetail ?? []).map((r: any) => r.institucion_educativa);
    setAssignedIes((assignedList ?? []) as IeRow[]);
    setSelectedIe("");
    setSelectedMonitor("");
    setIePickerSearch("");
    setBusyAssign(false);
  };

  const handleUnassign = async (ieId: string) => {
    const { error } = await supabase
      .from("monitoreo_ie_asignacion")
      .delete()
      .eq("monitoreo_id", monitoreoId)
      .eq("institucion_id", ieId);
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setAsignaciones((prev) => prev.filter((a) => a.institucion_id !== ieId));
    setAssignedIes((prev) => prev.filter((ie) => ie.id !== ieId));
    if (selectedIe === ieId) {
      setSelectedIe("");
      setIePickerSearch("");
    }
  };

  const handleAutoAssign = async () => {
    setBusyAuto(true);
    const { error } = await supabase.rpc("asignar_ie_automatico_rei", {
      p_monitoreo_id: monitoreoId,
    });
    if (error) {
      setToast({ type: "err", msg: error.message });
      setBusyAuto(false);
      return;
    }
    const { data: asigIe } = await supabase
      .from("monitoreo_ie_asignacion")
      .select("id, institucion_id, user_id")
      .eq("monitoreo_id", monitoreoId);
    setAsignaciones((asigIe ?? []) as AsigRow[]);
    setBusyAuto(false);
  };

  const addExtra = async () => {
    const title = extraTitle.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("monitoreo_actividad_extra")
      .insert({
        monitoreo_id: monitoreoId,
        created_by: profile?.id,
        titulo: title,
        orden: extras.length + 1,
      })
      .select("id, titulo")
      .single();
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setExtras((prev) => [...prev, data as ExtraActividadRow]);
    setExtraTitle("");
  };

  const addActividad = async () => {
    const title = actividadTitle.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("monitoreo_actividad")
      .insert({
        monitoreo_id: monitoreoId,
        titulo: title,
        obligatorio: actividadOblig,
        orden: actividades.length + 1,
      })
      .select("id, titulo, obligatorio")
      .single();
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setActividades((prev) => [...prev, data as ActividadRow]);
    setActividadTitle("");
    setActividadOblig(true);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Cargando seguimiento...
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-5 overflow-x-hidden text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-xs text-white">
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Seguimiento</h1>
          <p className="mt-1 text-sm text-white/60">
            Asignación de IE y avance por actividades.
          </p>
        </div>
        <div className="w-full min-w-0 sm:min-w-[220px] sm:max-w-[320px]">
          <div className="mb-2 text-xs text-white/60">Monitoreo</div>
          <select
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={monitoreoId}
            onChange={(e) => setMonitoreoId(e.target.value)}
          >
            {monitoreos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canManage && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold">Asignación de IE</div>
            <button
              type="button"
              onClick={handleAutoAssign}
              disabled={busyAuto || !monitoreoId}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              {busyAuto ? "Asignando..." : "Asignar automáticamente por REI"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <div className="space-y-2">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="Buscar IE por nombre o código"
                list="ie-picker-list"
                value={iePickerSearch}
                onChange={(e) => {
                  const next = e.target.value;
                  setIePickerSearch(next);
                  const matched = iePickerOptions.find((ie) => iePickerLabel(ie) === next);
                  if (matched) setSelectedIe(matched.id);
                }}
              />
              <datalist id="ie-picker-list">
                {iePickerOptions.map((ie) => (
                  <option key={ie.id} value={iePickerLabel(ie)} />
                ))}
              </datalist>
            </div>
            <select
              className="w-full min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={selectedMonitor}
              onChange={(e) => setSelectedMonitor(e.target.value)}
            >
              <option value="">Selecciona monitor</option>
              {monitores.map((m) => (
                <option key={m.id} value={m.id}>
                  {displayName(m)} {m.rei ? `(REI ${m.rei})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssign}
              disabled={busyAssign || !selectedIe || !selectedMonitor}
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15 md:w-auto"
            >
              {busyAssign ? "Guardando..." : "Asignar"}
            </button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Instituciones asignadas</div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <label className="text-xs text-white/60">
              Buscar IE
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="Nombre o código modular"
                value={ieSearch}
                onChange={(e) => {
                  setIeSearch(e.target.value);
                  setIePage(1);
                }}
              />
            </label>
            <label className="text-xs text-white/60">
              Ver
              <select
                className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={iePageSize}
                onChange={(e) => {
                  setIePageSize(Number(e.target.value));
                  setIePage(1);
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs text-white/50">
              {filteredIes.length} resultados
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-white/80">
            {pageIes.map((ie) => {
              const asig = asigByIe[ie.id];
              const monitor = asig ? monitoresById[asig.user_id] : null;
              const pct = progressByIe[ie.id] ?? 0;
              const val = latestValidByIe[ie.id];
              return (
                <div key={ie.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-medium">{ie.nombre}</div>
                    <div className="text-xs text-white/50">
                      {ie.codigo_modular || "-"} · REI {ie.rei || "SIN"}
                    </div>
                    <div className="break-words text-xs text-white/50">
                      Monitor: {monitor ? displayName(monitor) : "Sin asignar"}
                    </div>
                    {val && (
                      <div className="break-words text-xs text-white/50">
                        Validado: {val.porcentaje}% · {new Date(val.validado_at).toLocaleDateString("es-PE")}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-white/60">Avance: {pct}%</div>
                  {canManage && asig && (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <button
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                        onClick={() => handleUnassign(ie.id)}
                      >
                        Quitar
                      </button>
                      <button
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
                        onClick={() => {
                          setValidateIe(ie);
                          setValidateMonitor(monitor || null);
                          setValidatePct(pct);
                          setValidateComment(val?.comentario ?? "");
                          setValidateOpen(true);
                        }}
                      >
                        Validar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {pageIes.length === 0 && (
              <div className="text-xs text-white/50">Sin instituciones para mostrar.</div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
            <div>
              Página {iePage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                onClick={() => setIePage((p) => Math.max(1, p - 1))}
                disabled={iePage <= 1}
              >
                Anterior
              </button>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                onClick={() => setIePage((p) => Math.min(totalPages, p + 1))}
                disabled={iePage >= totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Actividades globales</div>
            {cddFlag && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                CdD
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_auto_auto]">
            <input
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              placeholder="Nombre de actividad"
              value={actividadTitle}
              onChange={(e) => setActividadTitle(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={actividadOblig}
                onChange={(e) => setActividadOblig(e.target.checked)}
              />
              Obligatoria
            </label>
            <button
              type="button"
              onClick={addActividad}
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs"
            >
              Agregar
            </button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-white/80">
            {actividades.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="font-medium">{a.titulo}</span>
                {a.obligatorio && (
                  <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">
                    Obligatoria
                  </span>
                )}
              </div>
            ))}
            {!actividades.length && (
              <div className="text-xs text-white/50">Sin actividades registradas.</div>
            )}
          </div>
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Resumen por monitor</div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <label className="text-xs text-white/60">
              Buscar monitor
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="Nombre o REI"
                value={monitorSearch}
                onChange={(e) => {
                  setMonitorSearch(e.target.value);
                  setMonitorPage(1);
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={monitorOnlyZeroValidated}
                onChange={(e) => {
                  setMonitorOnlyZeroValidated(e.target.checked);
                  setMonitorPage(1);
                }}
              />
              Solo 0% validado
            </label>
            <label className="text-xs text-white/60">
              Ver
              <select
                className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={monitorPageSize}
                onChange={(e) => {
                  setMonitorPageSize(Number(e.target.value));
                  setMonitorPage(1);
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs text-white/50">{filteredMonitorRows.length} resultados</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pageMonitorRows.map((row) => {
              return (
                <div key={row.monitor.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-medium">{displayName(row.monitor)}</div>
                  <div className="text-xs text-white/50">REI {row.monitor.rei || "SIN"}</div>
                  <div className="mt-2 text-xs text-white/60">
                    IE asignadas: {row.assignedCount}
                  </div>
                  <div className="mt-1 text-xs text-emerald-300">
                    Avance validado: {row.avgValidated}% ({row.validatedCount} IE)
                  </div>
                  <div className="mt-1 text-xs text-amber-300">
                    Avance sin validar: {row.avgPendingValidation}% ({row.pendingCount} IE)
                  </div>
                </div>
              );
            })}
            {!pageMonitorRows.length && (
              <div className="text-xs text-white/50">Sin monitores asignados.</div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
            <div>
              Pagina {monitorPage} de {monitorTotalPages}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                onClick={() => setMonitorPage((p) => Math.max(1, p - 1))}
                disabled={monitorPage <= 1}
              >
                Anterior
              </button>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                onClick={() => setMonitorPage((p) => Math.min(monitorTotalPages, p + 1))}
                disabled={monitorPage >= monitorTotalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">Mis instituciones asignadas</div>
        {loadingDetails && (
          <div className="mt-2 text-xs text-white/50">Cargando avances...</div>
        )}
        {!myAssignedIes.length ? (
          <div className="mt-3 text-xs text-white/50">No tienes IE asignadas.</div>
        ) : (
          <div className="mt-4 space-y-4">
            {myAssignedIes.map((ie) => (
              <div key={ie.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="break-words font-medium">{ie.nombre}</div>
                <div className="text-xs text-white/50">
                  {ie.codigo_modular || "-"} · REI {ie.rei || "SIN"}
                </div>
                <div className="mt-3 space-y-2">
                  {actividades.map((a) => {
                    const done = avances.some(
                      (av) =>
                        av.institucion_id === ie.id &&
                        av.user_id === profile?.id &&
                        av.actividad_id === a.id &&
                        av.tipo_actividad === "global" &&
                        av.realizado
                    );
                    return (
                      <label key={a.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleAvance(ie.id, a.id, "global")}
                        />
                        <span className="break-words">{a.titulo}</span>
                        {a.obligatorio && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">
                            Obligatoria
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/60">Actividades opcionales</div>
                  <div className="mt-2 space-y-2">
                    {extras.map((ex) => {
                      const done = avances.some(
                        (av) =>
                          av.institucion_id === ie.id &&
                          av.user_id === profile?.id &&
                          av.actividad_id === ex.id &&
                          av.tipo_actividad === "extra" &&
                          av.realizado
                      );
                      return (
                        <label key={ex.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleAvance(ie.id, ex.id, "extra")}
                          />
                          <span className="break-words">{ex.titulo}</span>
                        </label>
                      );
                    })}
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                        placeholder="Nueva actividad opcional"
                        value={extraTitle}
                        onChange={(e) => setExtraTitle(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={addExtra}
                        className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {validateOpen && validateIe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-4">
            <div className="text-sm font-semibold">Validar IE</div>
            <div className="mt-2 text-xs text-white/60">{validateIe.nombre}</div>
            <div className="mt-1 text-xs text-white/50">
              Monitor: {validateMonitor ? displayName(validateMonitor) : "Sin asignar"}
            </div>
            <label className="mt-3 block text-xs text-white/70">
              Porcentaje de avance
              <input
                type="number"
                min={0}
                max={100}
                value={validatePct}
                onChange={(e) => setValidatePct(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs text-white/70">
              Comentario
              <textarea
                value={validateComment}
                onChange={(e) => setValidateComment(e.target.value)}
                className="mt-1 min-h-[70px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                onClick={() => setValidateOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
                onClick={async () => {
                  if (!validateIe || !validateMonitor) return;
                  const { data, error } = await supabase
                    .from("monitoreo_ie_validacion")
                    .insert({
                      monitoreo_id: monitoreoId,
                      institucion_id: validateIe.id,
                      user_id: validateMonitor.id,
                      validado_por: profile?.id,
                      porcentaje: validatePct,
                      comentario: validateComment || null,
                    })
                    .select("id, institucion_id, user_id, porcentaje, comentario, validado_at")
                    .single();
                  if (error) {
                    setToast({ type: "err", msg: error.message });
                    return;
                  }
                  setValidaciones((prev) => [...prev, data as ValidacionRow]);
                  setValidateOpen(false);
                  setToast({ type: "ok", msg: "Validación registrada." });
                }}
              >
                Guardar validación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
