import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";

type CatalogItem = { id: string; nombre: string };

type InstitucionRow = {
  id: string;
  codigo_modular: string;
  codigo_local: string | null;
  nombre: string;
  director: string | null;
  nivel: { nombre: string } | null;
  modalidad: { nombre: string } | null;
  ugel: { nombre: string } | null;
  distrito: { nombre: string } | null;
};

type FormState = {
  id: string | null;
  codigo_modular: string;
  codigo_local: string;
  nombre: string;
  codigo_institucional: string;
  nivel_id: string;
  modalidad_id: string;
  tipo_sexo: string;
  gestion: string;
  director: string;
  direccion: string;
  departamento_id: string;
  provincia_id: string;
  distrito_id: string;
  dre_id: string;
  ugel_id: string;
  latitud: string;
  longitud: string;
  estado: string;
  cant_alumnos_hombres: string;
  cant_alumnos_mujeres: string;
  cant_alumnos_total: string;
  cant_docentes: string;
  cant_secciones: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function labelGestion(value: string) {
  return value;
}

const emptyForm: FormState = {
  id: null,
  codigo_modular: "",
  codigo_local: "",
  nombre: "",
  codigo_institucional: "",
  nivel_id: "",
  modalidad_id: "",
  tipo_sexo: "",
  gestion: "",
  director: "",
  direccion: "",
  departamento_id: "",
  provincia_id: "",
  distrito_id: "",
  dre_id: "",
  ugel_id: "",
  latitud: "",
  longitud: "",
  estado: "",
  cant_alumnos_hombres: "",
  cant_alumnos_mujeres: "",
  cant_alumnos_total: "",
  cant_docentes: "",
  cant_secciones: "",
};

export function InstitucionesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InstitucionRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [q, setQ] = useState("");
  const [nivelId, setNivelId] = useState("");
  const [modalidadId, setModalidadId] = useState("");
  const [distritoId, setDistritoId] = useState("");
  const [gestion, setGestion] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [niveles, setNiveles] = useState<CatalogItem[]>([]);
  const [modalidades, setModalidades] = useState<CatalogItem[]>([]);
  const [ugeles, setUgeles] = useState<CatalogItem[]>([]);
  const [distritos, setDistritos] = useState<CatalogItem[]>([]);
  const [departamentos, setDepartamentos] = useState<CatalogItem[]>([]);
  const [provincias, setProvincias] = useState<CatalogItem[]>([]);
  const [dres, setDres] = useState<CatalogItem[]>([]);
  const [gestiones, setGestiones] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [niv, mod, ug, dist, dep, prov, dre, ges] = await Promise.all([
        supabase.from("cat_nivel").select("id, nombre").order("nombre"),
        supabase.from("cat_modalidad").select("id, nombre").order("nombre"),
        supabase.from("cat_ugel").select("id, nombre").order("nombre"),
        supabase.from("cat_distrito").select("id, nombre").order("nombre"),
        supabase.from("cat_departamento").select("id, nombre").order("nombre"),
        supabase.from("cat_provincia").select("id, nombre").order("nombre"),
        supabase.from("cat_dre").select("id, nombre").order("nombre"),
        supabase.from("institucion_educativa").select("gestion").range(0, 10000),
      ]);
      if (!alive) return;
      if (niv.data) setNiveles(niv.data as CatalogItem[]);
      if (mod.data) setModalidades(mod.data as CatalogItem[]);
      if (ug.data) setUgeles(ug.data as CatalogItem[]);
      if (dist.data) setDistritos(dist.data as CatalogItem[]);
      if (dep.data) setDepartamentos(dep.data as CatalogItem[]);
      if (prov.data) setProvincias(prov.data as CatalogItem[]);
      if (dre.data) setDres(dre.data as CatalogItem[]);
      if (ges.data) {
        const raw = (ges.data as Array<{ gestion: string | null }>)
          .map((g) => g.gestion?.trim())
          .filter((v): v is string => !!v);
        const uniq = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
        setGestiones(uniq);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("institucion_educativa")
        .select(
          "id, codigo_modular, codigo_local, nombre, director, nivel:cat_nivel(nombre), modalidad:cat_modalidad(nombre), ugel:cat_ugel(nombre), distrito:cat_distrito(nombre)",
          { count: "exact" }
        )
        .order("nombre", { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (nivelId) query = query.eq("nivel_id", nivelId);
      if (modalidadId) query = query.eq("modalidad_id", modalidadId);
      if (gestion) query = query.eq("gestion", gestion);
      if (distritoId) query = query.eq("distrito_id", distritoId);
      if (q.trim()) {
        const term = q.trim().replaceAll("%", "");
        query = query.or(
          `codigo_modular.ilike.%${term}%,codigo_local.ilike.%${term}%,nombre.ilike.%${term}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      setTotal(count ?? 0);
      const rows = (data ?? []).map((row: any) => ({
        ...row,
        nivel: Array.isArray(row.nivel) ? row.nivel[0] ?? null : row.nivel ?? null,
        modalidad: Array.isArray(row.modalidad) ? row.modalidad[0] ?? null : row.modalidad ?? null,
        ugel: Array.isArray(row.ugel) ? row.ugel[0] ?? null : row.ugel ?? null,
        distrito: Array.isArray(row.distrito) ? row.distrito[0] ?? null : row.distrito ?? null,
      })) as InstitucionRow[];
      setItems(rows);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar instituciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q, nivelId, modalidadId, gestion, distritoId, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, nivelId, modalidadId, gestion, distritoId, pageSize]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const startCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = async (row: InstitucionRow) => {
    const { data, error } = await supabase
      .from("institucion_educativa")
      .select("*")
      .eq("id", row.id)
      .maybeSingle();
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    const r = data as any;
    setForm({
      id: r.id,
      codigo_modular: r.codigo_modular ?? "",
      codigo_local: r.codigo_local ?? "",
      nombre: r.nombre ?? "",
      codigo_institucional: r.codigo_institucional ?? "",
      nivel_id: r.nivel_id ?? "",
      modalidad_id: r.modalidad_id ?? "",
      tipo_sexo: r.tipo_sexo ?? "",
      gestion: r.gestion ?? "",
      director: r.director ?? "",
      direccion: r.direccion ?? "",
      departamento_id: r.departamento_id ?? "",
      provincia_id: r.provincia_id ?? "",
      distrito_id: r.distrito_id ?? "",
      dre_id: r.dre_id ?? "",
      ugel_id: r.ugel_id ?? "",
      latitud: r.latitud?.toString() ?? "",
      longitud: r.longitud?.toString() ?? "",
      estado: r.estado ?? "",
      cant_alumnos_hombres: r.cant_alumnos_hombres?.toString() ?? "",
      cant_alumnos_mujeres: r.cant_alumnos_mujeres?.toString() ?? "",
      cant_alumnos_total: r.cant_alumnos_total?.toString() ?? "",
      cant_docentes: r.cant_docentes?.toString() ?? "",
      cant_secciones: r.cant_secciones?.toString() ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.codigo_modular.trim() || !form.nombre.trim()) {
      setToast({ type: "err", msg: "codigo modular y nombre son obligatorios." });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        codigo_modular: form.codigo_modular.trim(),
        codigo_local: form.codigo_local.trim() || null,
        nombre: form.nombre.trim(),
        codigo_institucional: form.codigo_institucional.trim() || null,
        nivel_id: form.nivel_id || null,
        modalidad_id: form.modalidad_id || null,
        tipo_sexo: form.tipo_sexo.trim() || null,
        gestion: form.gestion.trim() || null,
        director: form.director.trim() || null,
        direccion: form.direccion.trim() || null,
        departamento_id: form.departamento_id || null,
        provincia_id: form.provincia_id || null,
        distrito_id: form.distrito_id || null,
        dre_id: form.dre_id || null,
        ugel_id: form.ugel_id || null,
        latitud: form.latitud ? Number(form.latitud) : null,
        longitud: form.longitud ? Number(form.longitud) : null,
        estado: form.estado.trim() || null,
        cant_alumnos_hombres: form.cant_alumnos_hombres
          ? Number(form.cant_alumnos_hombres)
          : null,
        cant_alumnos_mujeres: form.cant_alumnos_mujeres
          ? Number(form.cant_alumnos_mujeres)
          : null,
        cant_alumnos_total: form.cant_alumnos_total
          ? Number(form.cant_alumnos_total)
          : null,
        cant_docentes: form.cant_docentes ? Number(form.cant_docentes) : null,
        cant_secciones: form.cant_secciones ? Number(form.cant_secciones) : null,
      };

      if (form.id) {
        const { error } = await supabase
          .from("institucion_educativa")
          .update(payload)
          .eq("id", form.id);
        if (error) throw new Error(error.message);
        setToast({ type: "ok", msg: "Institucion actualizada." });
      } else {
        const { error } = await supabase.from("institucion_educativa").insert(payload);
        if (error) throw new Error(error.message);
        setToast({ type: "ok", msg: "Institucion creada." });
      }

      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: InstitucionRow) => {
    if (!confirm(`Â¿Eliminar ${row.nombre}?`)) return;
    const { error } = await supabase.from("institucion_educativa").delete().eq("id", row.id);
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setToast({ type: "ok", msg: "Institucion eliminada." });
    await load();
  };

  const filtered = useMemo(() => items, [items]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Instituciones educativas
        </h1>
        <p className="text-sm text-white/60">
          {isAdmin
            ? "Administra el padron de instituciones."
            : "Consulta instituciones educativas."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por codigo o nombre..."
          className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/10 lg:col-span-2"
        />
        <select
          value={nivelId}
          onChange={(e) => setNivelId(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10"
        >
          <option value="">Nivel</option>
          {niveles.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nombre}
            </option>
          ))}
        </select>
        <select
          value={modalidadId}
          onChange={(e) => setModalidadId(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10"
        >
          <option value="">Modalidad</option>
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select
          value={gestion}
          onChange={(e) => setGestion(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10"
        >
          <option value="">Gestion</option>
          {gestiones.map((g) => (
            <option key={g} value={g}>
              {labelGestion(g)}
            </option>
          ))}
        </select>
        <select
          value={distritoId}
          onChange={(e) => setDistritoId(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10"
        >
          <option value="">Distrito</option>
          {distritos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
        <span>Mostrando {items.length} de {total}</span>
        <label className="flex items-center gap-2">
          <span>Por pagina</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80 outline-none"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isAdmin && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCreate}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/15"
          >
            Nueva institucion
          </button>
          {showForm && (
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-2 text-sm text-white/70 hover:bg-zinc-900"
            >
              Cerrar formulario
            </button>
          )}
        </div>
      )}

      {showForm && isAdmin && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.codigo_modular}
              onChange={(e) => setForm({ ...form, codigo_modular: e.target.value })}
              placeholder="codigo modular *"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.codigo_local}
              onChange={(e) => setForm({ ...form, codigo_local: e.target.value })}
              placeholder="codigo local"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre institucion *"
              className="md:col-span-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.codigo_institucional}
              onChange={(e) => setForm({ ...form, codigo_institucional: e.target.value })}
              placeholder="codigo institucional"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.director}
              onChange={(e) => setForm({ ...form, director: e.target.value })}
              placeholder="Director"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              placeholder="Direccion"
              className="md:col-span-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <select
              value={form.nivel_id}
              onChange={(e) => setForm({ ...form, nivel_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">Nivel</option>
              {niveles.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.modalidad_id}
              onChange={(e) => setForm({ ...form, modalidad_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">Modalidad</option>
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.dre_id}
              onChange={(e) => setForm({ ...form, dre_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">DRE</option>
              {dres.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.ugel_id}
              onChange={(e) => setForm({ ...form, ugel_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">UGEL</option>
              {ugeles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.departamento_id}
              onChange={(e) => setForm({ ...form, departamento_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">Departamento</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.provincia_id}
              onChange={(e) => setForm({ ...form, provincia_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">Provincia</option>
              {provincias.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.distrito_id}
              onChange={(e) => setForm({ ...form, distrito_id: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="">Distrito</option>
              {distritos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <input
              value={form.gestion}
              onChange={(e) => setForm({ ...form, gestion: e.target.value })}
              placeholder="Gestion"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.tipo_sexo}
              onChange={(e) => setForm({ ...form, tipo_sexo: e.target.value })}
              placeholder="Tipo sexo"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              placeholder="Estado"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.latitud}
              onChange={(e) => setForm({ ...form, latitud: e.target.value })}
              placeholder="Latitud"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.longitud}
              onChange={(e) => setForm({ ...form, longitud: e.target.value })}
              placeholder="Longitud"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.cant_alumnos_hombres}
              onChange={(e) => setForm({ ...form, cant_alumnos_hombres: e.target.value })}
              placeholder="Alumnos hombres"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.cant_alumnos_mujeres}
              onChange={(e) => setForm({ ...form, cant_alumnos_mujeres: e.target.value })}
              placeholder="Alumnos mujeres"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.cant_alumnos_total}
              onChange={(e) => setForm({ ...form, cant_alumnos_total: e.target.value })}
              placeholder="Alumnos total"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.cant_docentes}
              onChange={(e) => setForm({ ...form, cant_docentes: e.target.value })}
              placeholder="Docentes"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
            <input
              value={form.cant_secciones}
              onChange={(e) => setForm({ ...form, cant_secciones: e.target.value })}
              placeholder="Secciones"
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        {loading ? (
          <div className="text-sm text-white/60">Cargando instituciones...</div>
        ) : error ? (
          <div className="text-sm text-red-100">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-white/60">No hay resultados.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-white/10 bg-zinc-900/40 p-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{row.nombre}</div>
                    <div className="text-xs text-white/50">
                      {row.codigo_modular}
                      {row.codigo_local ? ` - ${row.codigo_local}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {row.nivel?.nombre || "Nivel: -"} -{" "}
                      {row.modalidad?.nombre || "Modalidad: -"} -{" "}
                      {row.ugel?.nombre || "UGEL: -"} -{" "}
                      {row.distrito?.nombre || "Distrito: -"}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      Director: {row.director || "-"}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/20"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/20"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
            <div>
              pagina {page} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cls(
                  "rounded-lg border px-3 py-1.5",
                  page === 1
                    ? "border-white/10 text-white/30"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                )}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={cls(
                  "rounded-lg border px-3 py-1.5",
                  page === totalPages
                    ? "border-white/10 text-white/30"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                )}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


