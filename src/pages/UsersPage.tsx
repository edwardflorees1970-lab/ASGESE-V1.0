import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AdminCreateUserInput,
  type ProfileRow,
  type UsersListQuery,
  adminCreateUser,
  adminResetPassword,
  adminUsersDelete,
  adminUsersList,
  adminUsersUpdate,
} from "../lib/adminApi";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole, isAdminRole, roleLabel } from "../lib/roles";
import { supabase } from "../lib/supabaseClient";
import { ConfirmDialog } from "../components/ConfirmDialog";


type Toast = { type: "ok" | "err"; msg: string } | null;

const REI_OPTIONS = ["SIN REI", ...Array.from({ length: 19 }, (_, i) => `REI ${i + 1}`)];

const emptyCreateForm: AdminCreateUserInput = {
  tipo_documento: "DNI",
  numero_documento: "",
  apellido_paterno: "",
  apellido_materno: "",
  nombres: "",
  correo: "",
  telefono: "",
  fecha_nacimiento: "",
  cargo: "",
  area: "",
  comision: "",
  ugel: "UGEL 06",
  rei: "SIN REI",
  can_create_monitoreo: false,
  rol: "user",
  password: "",
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatName(u: ProfileRow) {
  return `${u.apellido_paterno} ${u.apellido_materno}, ${u.nombres}`.trim();
}

function maskDoc(tipo: string, num: string) {
  if (!num) return `${tipo}: -`;
  return `${tipo}: ${num}`;
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-start justify-center p-4 md:items-center">
        <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="text-sm font-semibold">{title}</div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/5"
            >
              Cerrar
            </button>
          </div>
          <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

function Button({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const base =
    "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "executive-primary-action"
      : variant === "danger"
      ? "bg-red-500/90 text-white hover:bg-red-500"
      : "bg-white/5 text-white hover:bg-white/10 border border-white/10";
  return <button {...props} className={cls(base, styles, props.className)} />;
}

function IconButton({
  variant = "ghost",
  title,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "danger";
  title: string;
}) {
  const styles =
    variant === "danger"
      ? "border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20"
      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white";
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      title={title}
      aria-label={title}
      className={cls(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        props.className
      )}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0 0-3L17.5 5a2.1 2.1 0 0 0-3 0L4 15.5V20Z" />
      <path d="m13.5 6 4.5 4.5" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="12" r="3.25" />
      <path d="M11.25 12H21m-4 0v3m-3-3v2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M10 11v6m4-6v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function EyeIcon({ closed = false }: { closed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      {closed ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
          <path d="M9.3 5.4A9.4 9.4 0 0 1 12 5c5 0 8.3 4.2 9.4 6a13.5 13.5 0 0 1-2.5 3.1" />
          <path d="M6.1 6.9A13.7 13.7 0 0 0 2.6 11C3.7 12.8 7 17 12 17c1 0 2-.2 2.8-.5" />
        </>
      ) : (
        <>
          <path d="M2.6 12S6 5 12 5s9.4 7 9.4 7-3.4 7-9.4 7-9.4-7-9.4-7Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
    </svg>
  );
}

export function UsersPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canManageUsers = isAdminRole(role);
  const canSeeAll = canSeeAllRole(role);
  const [toast, setToast] = useState<Toast>(null);

  // Query UI
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<"" | "admin" | "user" | "jefe_area" | "director" | "responsable_cdd">("");
  const [area, setArea] = useState("");
  const [ugel, setUgel] = useState("");
  const [rei, setRei] = useState("");
  const [qInput, setQInput] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [ugelInput, setUgelInput] = useState("");
  const [reiInput, setReiInput] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [searchTick, setSearchTick] = useState(0);

  const query: UsersListQuery = useMemo(
    () => ({
      q: q.trim() || undefined,
      rol: (rol || undefined) as any,
      area: area.trim() || undefined,
      ugel: ugel.trim() || undefined,
      rei: rei.trim() || undefined,
      page,
      pageSize,
    }),
    [q, rol, area, ugel, rei, page]
  );

  // Data
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Modals & actions
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState<AdminCreateUserInput>(
    emptyCreateForm
  );
  const [createBusy, setCreateBusy] = useState(false);

  const [openEdit, setOpenEdit] = useState(false);
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const [openReset, setOpenReset] = useState(false);
  const [resetUser, setResetUser] = useState<ProfileRow | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<ProfileRow | null>(null);
  const requestIdRef = useRef(0);

  const load = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (canManageUsers) {
        const res = await adminUsersList(query);
        if (requestId !== requestIdRef.current) return;
        setItems(res.items);
        setTotal(res.total);
      } else if (canSeeAll) {
        let qx = supabase
          .from("profiles")
          .select(
            "id, role, tipo_documento, numero_documento, apellido_paterno, apellido_materno, nombres, correo, email, telefono, fecha_nacimiento, cargo, area, comision, ugel, rei",
            { count: "exact" }
          )
          .order("apellido_paterno", { ascending: true })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (rol) qx = qx.eq("role", rol);
        if (area.trim()) qx = qx.ilike("area", `%${area.trim()}%`);
        if (ugel.trim()) qx = qx.ilike("ugel", `%${ugel.trim()}%`);
        if (rei.trim()) qx = qx.eq("rei", rei.trim());
        if (q.trim()) {
          const term = q.trim().replaceAll("%", "");
          qx = qx.or(
            [
              `apellido_paterno.ilike.%${term}%`,
              `apellido_materno.ilike.%${term}%`,
              `nombres.ilike.%${term}%`,
              `correo.ilike.%${term}%`,
              `email.ilike.%${term}%`,
              `numero_documento.ilike.%${term}%`,
            ].join(",")
          );
        }

        const { data, error, count } = await qx;
        if (error) throw new Error(error.message);
        if (requestId !== requestIdRef.current) return;
        const mapped = (data ?? []).map((u: any) => ({
          id: u.id,
          tipo_documento: u.tipo_documento,
          numero_documento: u.numero_documento,
          apellido_paterno: u.apellido_paterno,
          apellido_materno: u.apellido_materno,
          nombres: u.nombres,
          correo: u.correo,
          telefono: u.telefono,
          fecha_nacimiento: u.fecha_nacimiento,
          cargo: u.cargo,
          area: u.area,
          comision: u.comision,
          ugel: u.ugel,
          rei: u.rei ?? "SIN REI",
          can_create_monitoreo: u.can_create_monitoreo ?? false,
          rol: u.role,
        })) as ProfileRow[];
        setItems(mapped);
        setTotal(count ?? 0);
      }
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;
      setToast({ type: "err", msg: e?.message || "No se pudo cargar usuarios" });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query.q,
    query.rol,
    query.area,
    query.ugel,
    query.rei,
    query.page,
    query.pageSize,
    searchTick,
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const onSearch = () => {
    setPage(1);
    setQ(qInput.trim());
    setArea(areaInput.trim());
    setUgel(ugelInput.trim());
    setRei(reiInput.trim());
    setSearchTick((s) => s + 1);
  };

  const openEditModal = (u: ProfileRow) => {
    setEditUser(u);
    setOpenEdit(true);
  };

  const openResetModal = (u: ProfileRow) => {
    setResetUser(u);
    setResetPass("");
    setShowResetPass(false);
    setOpenReset(true);
  };

  const submitCreate = async () => {
    if (!canManageUsers) return;
    if (!createForm.password || createForm.password.trim().length < 8) {
      setToast({ type: "err", msg: "La contraseña debe tener mínimo 8 caracteres." });
      return;
    }
    if (
      !createForm.correo.trim() ||
      !createForm.numero_documento.trim() ||
      !createForm.apellido_paterno.trim() ||
      !createForm.apellido_materno.trim() ||
      !createForm.nombres.trim()
    ) {
      setToast({ type: "err", msg: "Completa los campos obligatorios antes de crear." });
      return;
    }

    setCreateBusy(true);
    try {
      // Normalizar correo
      const payload: AdminCreateUserInput = {
        ...createForm,
        correo: createForm.correo.trim().toLowerCase(),
        numero_documento: createForm.numero_documento.trim(),
        apellido_paterno: createForm.apellido_paterno.trim(),
        apellido_materno: createForm.apellido_materno.trim(),
        nombres: createForm.nombres.trim(),
        area: createForm.area?.trim() || null,
        comision: createForm.comision?.trim() || null,
        cargo: createForm.cargo?.trim() || null,
        ugel: createForm.ugel?.trim() || null,
        rei: createForm.rei?.trim() || "SIN REI",
        can_create_monitoreo: !!createForm.can_create_monitoreo,
        telefono: createForm.telefono?.trim() || null,
        fecha_nacimiento: createForm.fecha_nacimiento?.trim() || null,
      };

      const res = await adminCreateUser(payload);
      if (res.ok) {
        setToast({ type: "ok", msg: "Usuario creado correctamente." });
      } else {
        setToast({
          type: "err",
          msg: res.warning
            ? `Creado con advertencia: ${res.warning}`
            : "Creado, pero revisa detalles.",
        });
      }

      setOpenCreate(false);
      setCreateForm(emptyCreateForm);
      setPage(1);
      void load();
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo crear" });
    } finally {
      setCreateBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!canManageUsers) return;
    if (!editUser) return;
    setEditBusy(true);
    try {
      const res = await adminUsersUpdate({
        id: editUser.id,
        tipo_documento: editUser.tipo_documento,
        numero_documento: editUser.numero_documento,
        apellido_paterno: editUser.apellido_paterno,
        apellido_materno: editUser.apellido_materno,
        nombres: editUser.nombres,
        correo: editUser.correo,
        telefono: editUser.telefono,
        fecha_nacimiento: editUser.fecha_nacimiento,
        cargo: editUser.cargo,
        area: editUser.area,
        comision: editUser.comision,
        ugel: editUser.ugel,
        rei: editUser.rei,
        can_create_monitoreo: editUser.can_create_monitoreo,
        rol: editUser.rol,
      });

      setToast({ type: "ok", msg: "Usuario actualizado." });
      if (res.warning) {
        setToast({ type: "err", msg: `${res.warning}: ${res.details ?? ""}` });
      }

      setOpenEdit(false);
      setEditUser(null);
      void load();
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo actualizar" });
    } finally {
      setEditBusy(false);
    }
  };

  const submitReset = async () => {
    if (!canManageUsers) return;
    if (!resetUser) return;
    setResetBusy(true);
    try {
      await adminResetPassword(resetUser.id, resetPass.trim());
      setToast({ type: "ok", msg: "Contraseña reseteada." });
      setOpenReset(false);
      setResetUser(null);
      setResetPass("");
      setShowResetPass(false);
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo resetear" });
    } finally {
      setResetBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!canManageUsers || !confirmDeleteUser) return;
    const u = confirmDeleteUser;

    setDeleteBusyId(u.id);
    try {
      await adminUsersDelete(u.id);
      setToast({ type: "ok", msg: "Usuario eliminado." });
      setPage(1);
      void load();
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo eliminar" });
    } finally {
      setDeleteBusyId(null);
      setConfirmDeleteOpen(false);
      setConfirmDeleteUser(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-0px)] bg-zinc-950 text-white">
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

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
            <p className="mt-1 text-sm text-white/60">
              {canManageUsers
                ? "Administra cuentas, roles y contraseñas."
                : "Consulta usuarios registrados."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </Button>
            {canManageUsers && (
              <Button
                onClick={() => {
                  setCreateForm(emptyCreateForm);
                  setOpenCreate(true);
                }}
              >
                + Crear usuario
              </Button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <Field label="Buscar (nombre, correo, documento)">
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Ej: acabreara / 75310856 / apellidos..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch();
                  }}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Rol">
                <Select value={rol} onChange={(e) => setRol(e.target.value as any)}>
                  <option value="">Todos</option>
                  <option value="admin">Admin</option>
                  <option value="jefe_area">Jefe de área</option>
                  <option value="director">Director(a)</option>
                  <option value="responsable_cdd">Responsable CdD</option>
                  <option value="user">User</option>
                </Select>
              </Field>
            </div>

            <div className="md:col-span-3">
              <Field label="Área">
                <Input
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="AGEBRE..."
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="UGEL">
                <Input
                  value={ugelInput}
                  onChange={(e) => setUgelInput(e.target.value)}
                  placeholder="UGEL 06"
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="REI">
                <Select value={reiInput} onChange={(e) => setReiInput(e.target.value)}>
                  <option value="">Todas</option>
                  {REI_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="md:col-span-12 flex gap-2 pt-2">
              <Button variant="ghost" onClick={onSearch}>
                Buscar
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setQ("");
                  setRol("");
                  setArea("");
                  setUgel("");
                  setRei("");
                  setQInput("");
                  setAreaInput("");
                  setUgelInput("");
                  setReiInput("");
                  setPage(1);
                  setSearchTick((s) => s + 1);
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>

        {/* Lista mobile */}
        <div className="mt-5 space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
              Cargando usuarios...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
              No hay resultados.
            </div>
          ) : (
            items.map((u) => (
              <div key={u.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{formatName(u)}</div>
                    <div className="truncate text-xs text-white/50">{u.correo}</div>
                  </div>
                  <span
                    className={cls(
                      "rounded-lg border px-2 py-1 text-xs",
                      u.rol === "admin"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-100 badge-amber"
                        : "border-white/10 bg-white/5 text-white/70"
                    )}
                  >
                    {roleLabel(u.rol)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                  <div>Documento: {maskDoc(u.tipo_documento, u.numero_documento)}</div>
                  <div>Área: {u.area || "-"}</div>
                  <div>UGEL: {u.ugel || "-"}</div>
                  <div>REI: {u.rei || "SIN REI"}</div>
                </div>

                {canManageUsers ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <IconButton title="Editar usuario" onClick={() => openEditModal(u)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton title="Resetear contraseña" onClick={() => openResetModal(u)}>
                      <KeyIcon />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      title={deleteBusyId === u.id ? "Eliminando..." : "Eliminar usuario"}
                      disabled={deleteBusyId === u.id}
                      onClick={() => {
                        setConfirmDeleteUser(u);
                        setConfirmDeleteOpen(true);
                      }}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-white/50">Solo lectura</div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60 md:hidden">
          <div>
            Mostrando {items.length} de {total} · Página {page}/{totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="px-3 py-2 text-xs"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-2 text-xs"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>

        {/* Tabla desktop */}
        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm text-white/70">
              Total: <span className="text-white">{total}</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-white/60">
              <span>Página</span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white">
                {page}/{totalPages}
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-[780px] w-full">
              <thead className="bg-black/20">
                <tr className="text-left text-xs text-white/60">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">UGEL</th>
                  <th className="px-4 py-3">REI</th>
                  {canManageUsers && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-white/60" colSpan={canManageUsers ? 7 : 6}>
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-white/60" colSpan={canManageUsers ? 7 : 6}>
                      No hay resultados.
                    </td>
                  </tr>
                ) : (
                  items.map((u) => (
                    <tr key={u.id} className="border-t border-white/10 text-sm">
                      <td className="px-4 py-3">
                        <div className="font-medium">{formatName(u)}</div>
                        <div className="text-xs text-white/50">{u.correo}</div>
                      </td>
                      <td className="px-4 py-3 text-white/80">{maskDoc(u.tipo_documento, u.numero_documento)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-lg border px-2 py-1 text-xs",
                            u.rol === "admin"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-100 badge-amber"
                              : "border-white/10 bg-white/5 text-white/70"
                          )}
                        >
                          {roleLabel(u.rol)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70">{u.area || "-"}</td>
                      <td className="px-4 py-3 text-white/70">{u.ugel || "-"}</td>
                      <td className="px-4 py-3 text-white/70">{u.rei || "SIN REI"}</td>
                      {canManageUsers && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <IconButton title="Editar usuario" onClick={() => openEditModal(u)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton title="Resetear contraseña" onClick={() => openResetModal(u)}>
                              <KeyIcon />
                            </IconButton>
                            <IconButton
                              variant="danger"
                              title={deleteBusyId === u.id ? "Eliminando..." : "Eliminar usuario"}
                              disabled={deleteBusyId === u.id}
                              onClick={() => {
                                setConfirmDeleteUser(u);
                                setConfirmDeleteOpen(true);
                              }}
                            >
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-white/50">
              Mostrando {items.length} de {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CREAR */}
      {canManageUsers && (
        <Modal
          open={openCreate}
          title="Crear usuario"
          onClose={() => !createBusy && setOpenCreate(false)}
        >
          <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-3">
            <Field label="Tipo doc">
              <Select
                value={createForm.tipo_documento}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, tipo_documento: e.target.value as any }))
                }
              >
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
              </Select>
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="N° documento">
              <Input
                value={createForm.numero_documento}
                onChange={(e) => setCreateForm((s) => ({ ...s, numero_documento: e.target.value }))}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Rol">
                <Select
                  value={createForm.rol ?? "user"}
                  onChange={(e) => setCreateForm((s) => ({ ...s, rol: e.target.value as any }))}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="jefe_area">jefe_area</option>
                  <option value="director">director</option>
                  <option value="responsable_cdd">responsable_cdd</option>
                </Select>
              </Field>
            </div>
          {createForm.rol === "user" && (
            <div className="md:col-span-3">
              <Field label="Crear monitoreos">
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={!!createForm.can_create_monitoreo}
                    onChange={(e) =>
                      setCreateForm((s) => ({ ...s, can_create_monitoreo: e.target.checked }))
                    }
                  />
                  Habilitar creación de monitoreos
                </label>
              </Field>
            </div>
          )}
          <div className="md:col-span-3">
            <Field label="UGEL">
              <Input
                value={createForm.ugel ?? ""}
                onChange={(e) => setCreateForm((s) => ({ ...s, ugel: e.target.value }))}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="REI">
              <Select
                value={createForm.rei ?? "SIN REI"}
                onChange={(e) => setCreateForm((s) => ({ ...s, rei: e.target.value }))}
              >
                {REI_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="md:col-span-4">
            <Field label="Apellido paterno">
              <Input
                value={createForm.apellido_paterno}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, apellido_paterno: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Apellido materno">
              <Input
                value={createForm.apellido_materno}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, apellido_materno: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Nombres">
              <Input
                value={createForm.nombres}
                onChange={(e) => setCreateForm((s) => ({ ...s, nombres: e.target.value }))}
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Correo (@ugel06.gob.pe)">
              <Input
                value={createForm.correo}
                onChange={(e) => setCreateForm((s) => ({ ...s, correo: e.target.value }))}
                placeholder="acabreara@ugel06.gob.pe"
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Teléfono">
              <Input
                value={createForm.telefono ?? ""}
                onChange={(e) => setCreateForm((s) => ({ ...s, telefono: e.target.value }))}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Fecha nacimiento">
              <Input
                type="date"
                value={createForm.fecha_nacimiento ?? ""}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, fecha_nacimiento: e.target.value }))
                }
              />
            </Field>
          </div>

          <div className="md:col-span-4">
            <Field label="Cargo">
              <Input
                value={createForm.cargo ?? ""}
                onChange={(e) => setCreateForm((s) => ({ ...s, cargo: e.target.value }))}
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Área">
              <Input
                value={createForm.area ?? ""}
                onChange={(e) => setCreateForm((s) => ({ ...s, area: e.target.value }))}
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Comisión">
              <Input
                value={createForm.comision ?? ""}
                onChange={(e) => setCreateForm((s) => ({ ...s, comision: e.target.value }))}
              />
            </Field>
          </div>

          <div className="md:col-span-6">
            <Field label="Contraseña inicial (mín. 8)">
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Define una clave inicial"
              />
            </Field>
          </div>

          <div className="md:col-span-12 flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpenCreate(false)} disabled={createBusy}>
              Cancelar
            </Button>
            <Button
              onClick={submitCreate}
              disabled={
                createBusy ||
                !createForm.password ||
                createForm.password.trim().length < 8 ||
                !createForm.correo.trim() ||
                !createForm.numero_documento.trim() ||
                !createForm.apellido_paterno.trim() ||
                !createForm.apellido_materno.trim() ||
                !createForm.nombres.trim()
              }
            >
              {createBusy ? "Creando..." : "Crear"}
            </Button>
          </div>
          </div>
        </Modal>
      )}

      {/* MODAL EDITAR */}
      {canManageUsers && (
        <Modal
          open={openEdit}
          title="Editar usuario"
          onClose={() => !editBusy && setOpenEdit(false)}
        >
          {!editUser ? (
            <div className="text-sm text-white/60">Sin usuario seleccionado.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-3">
              <Field label="Tipo doc">
                <Select
                  value={editUser.tipo_documento}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, tipo_documento: e.target.value as any } : s))
                  }
                >
                  <option value="DNI">DNI</option>
                  <option value="CE">CE</option>
                </Select>
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="N° documento">
                <Input
                  value={editUser.numero_documento}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, numero_documento: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Rol">
                <Select
                  value={editUser.rol}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, rol: e.target.value as any } : s))
                  }
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="jefe_area">jefe_area</option>
                  <option value="director">director</option>
                  <option value="responsable_cdd">responsable_cdd</option>
                </Select>
              </Field>
            </div>
            {editUser.rol === "user" && (
              <div className="md:col-span-3">
                <Field label="Crear monitoreos">
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={!!editUser.can_create_monitoreo}
                      onChange={(e) =>
                        setEditUser((s) =>
                          s ? { ...s, can_create_monitoreo: e.target.checked } : s
                        )
                      }
                    />
                    Habilitar creación de monitoreos
                  </label>
                </Field>
              </div>
            )}
            <div className="md:col-span-3">
              <Field label="UGEL">
                <Input
                  value={editUser.ugel ?? ""}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, ugel: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="REI">
                <Select
                  value={editUser.rei ?? "SIN REI"}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, rei: e.target.value } : s))
                  }
                >
                  {REI_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="md:col-span-4">
              <Field label="Apellido paterno">
                <Input
                  value={editUser.apellido_paterno}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, apellido_paterno: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-4">
              <Field label="Apellido materno">
                <Input
                  value={editUser.apellido_materno}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, apellido_materno: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-4">
              <Field label="Nombres">
                <Input
                  value={editUser.nombres}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, nombres: e.target.value } : s))
                  }
                />
              </Field>
            </div>

            <div className="md:col-span-6">
              <Field label="Correo">
                <Input
                  value={editUser.correo}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, correo: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Teléfono">
                <Input
                  value={editUser.telefono ?? ""}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, telefono: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Fecha nacimiento">
                <Input
                  type="date"
                  value={editUser.fecha_nacimiento ?? ""}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, fecha_nacimiento: e.target.value } : s))
                  }
                />
              </Field>
            </div>

            <div className="md:col-span-4">
              <Field label="Cargo">
                <Input
                  value={editUser.cargo ?? ""}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, cargo: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-4">
              <Field label="Área">
                <Input
                  value={editUser.area ?? ""}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, area: e.target.value } : s))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-4">
              <Field label="Comisión">
                <Input
                  value={editUser.comision ?? ""}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, comision: e.target.value } : s))
                  }
                />
              </Field>
            </div>

            <div className="md:col-span-12 flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpenEdit(false)} disabled={editBusy}>
                Cancelar
              </Button>
              <Button onClick={submitEdit} disabled={editBusy}>
                {editBusy ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL RESET PASSWORD */}
      {canManageUsers && (
        <Modal
          open={openReset}
          title="Resetear contraseña"
          onClose={() => !resetBusy && setOpenReset(false)}
        >
          {!resetUser ? (
            <div className="text-sm text-white/60">Sin usuario seleccionado.</div>
          ) : (
            <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">{formatName(resetUser)}</div>
              <div className="text-xs text-white/60">{resetUser.correo}</div>
            </div>

            <Field label="Nueva contraseña (mín. 8)">
              <div className="relative">
                <Input
                  type={showResetPass ? "text" : "password"}
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  placeholder="NuevaClave123!"
                  className="pr-12"
                />
                <button
                  type="button"
                  title={showResetPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-label={showResetPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowResetPass((s) => !s)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <EyeIcon closed={showResetPass} />
                </button>
              </div>
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenReset(false)} disabled={resetBusy}>
                Cancelar
              </Button>
              <Button
                onClick={submitReset}
                disabled={resetBusy || resetPass.trim().length < 8}
              >
                {resetBusy ? "Reseteando..." : "Resetear"}
              </Button>
            </div>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar usuario"
        description={
          confirmDeleteUser
            ? `Se eliminará a ${formatName(confirmDeleteUser)} (${confirmDeleteUser.correo}).`
            : "Se eliminará el usuario seleccionado."
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        busy={!!deleteBusyId}
        onClose={() => !deleteBusyId && setConfirmDeleteOpen(false)}
        onConfirm={submitDelete}
      />
    </div>
  );
}



