import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, clearLegacyAuthStorage } from "../lib/supabaseClient";
import logoAgebreUrl from "../assets/logoagebresf.png";

type LoginMode = "usuario" | "admin";

const docToEmail = (tipoDoc: string, numeroDoc: string) => {
  const t = (tipoDoc || "").trim().toLowerCase();
  const n = (numeroDoc || "").trim();
  if (!t || !n) throw new Error("Completa tipo y número de documento");
  return `${t}-${n}@ugel06.gob.pe`.toLowerCase();
};

export function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>("usuario");
  const [correo, setCorreo] = useState("");
  const [tipoDoc, setTipoDoc] = useState<"dni" | "ce">("dni");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const email =
        mode === "usuario"
          ? correo.trim().toLowerCase()
          : docToEmail(tipoDoc, numeroDoc);

      if (!email.endsWith("@ugel06.gob.pe")) {
        throw new Error("Solo se permiten correos institucionales @ugel06.gob.pe");
      }
      if (!password) throw new Error("Ingresa tu contraseña");

      // ✅ solo limpia legado, NO borra la sesión real
      clearLegacyAuthStorage();

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg =
          error.message.includes("Invalid login credentials")
            ? "Usuario o contraseña incorrectos"
            : error.message;
        throw new Error(msg);
      }

      if (!data?.session?.user) throw new Error("Login OK pero no se recibió sesión.");

      navigate("/app", { replace: true });
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.warn("LOGIN FAIL:", err?.message || err);
      }
      setErrorMsg(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7 shadow-xl backdrop-blur">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center">
                  <img
                    src={logoAgebreUrl}
                    alt="AGEBRE"
                    className="h-[38px] w-[38px] object-contain"
                  />
                </div>
                <div className="text-xs text-white/50">UGEL 06</div>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">AGEBRE Monitoreo</h1>
              <p className="mt-1 text-sm text-white/70">
                {mode === "usuario" ? "Ingreso de Usuario" : "Ingreso de Administrador"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMode("usuario")}
                  className={`rounded-lg px-3 py-1.5 ${
                    mode === "usuario"
                      ? "bg-white text-zinc-950"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  Usuario
                </button>
                <button
                  type="button"
                  onClick={() => setMode("admin")}
                  className={`rounded-lg px-3 py-1.5 ${
                    mode === "admin"
                      ? "bg-white text-zinc-950"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {mode === "usuario" ? (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/80">
                  Correo institucional
                </span>
                <input
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="acabreara@ugel06.gob.pe"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/10"
                />
              </label>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <span className="mb-2 block text-xs font-medium text-white/80">Tipo</span>
                  <select
                    value={tipoDoc}
                    onChange={(e) => setTipoDoc(e.target.value as any)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-white/10"
                  >
                    <option value="dni">DNI</option>
                    <option value="ce">CE</option>
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-medium text-white/80">
                    Número de documento
                  </span>
                  <input
                    value={numeroDoc}
                    onChange={(e) => setNumeroDoc(e.target.value)}
                    placeholder="11111111"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/10"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/80">Contraseña</span>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs text-white/70 hover:bg-white/5"
                >
                  {showPass ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 hover:bg-white/90 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Entrar"}
            </button>
          </div>
        </div>
        <div className="mt-4 text-center text-[11px] text-white/50">
          v1.0 Propietario UGEL 06®
        </div>
      </div>
    </div>
  );
}
