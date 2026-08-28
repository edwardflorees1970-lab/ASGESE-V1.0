import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { isStrongPassword } from "../lib/userImport";
import logoAgebreUrl from "../assets/logoagebresf.png";

export function SetupPasswordPage() {
  const { loading, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    if (!isStrongPassword(password)) return setMessage("Usa al menos 8 caracteres e incluye una mayúscula, una minúscula, un número y un carácter especial.");
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setBusy(false); return setMessage(error.message); }
    await refreshProfile();
    setBusy(false);
    navigate("/app", { replace: true });
  };

  return <main className="agebre-app-shell grid min-h-screen place-items-center px-4 py-8"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white"><img src={logoAgebreUrl} alt="" className="h-10 w-10 object-contain"/></div><div><div className="text-lg font-extrabold tracking-wide">ASGESE</div><div className="text-xs uppercase tracking-widest text-white/45">Seguridad de cuenta</div></div></div><h1 className="mt-6 text-2xl font-bold">Cambia tu contraseña temporal</h1><p className="mt-2 text-sm text-white/55">Antes de continuar, crea una contraseña personal que solo tú conozcas.</p>{loading ? <div className="mt-6 text-sm text-white/60">Validando sesión...</div> : !user ? <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Inicia sesión con el correo y la contraseña temporal entregados por el administrador.<div className="mt-3"><Link to="/login" className="font-semibold underline">Ir al inicio de sesión</Link></div></div> : <div className="mt-6 space-y-4"><div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial.</div><label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/65">Nueva contraseña</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sky-400/50"/></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/65">Confirmar contraseña</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sky-400/50"/></label>{message && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">{message}</div>}<button type="button" disabled={busy} onClick={save} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando..." : "Guardar contraseña e ingresar"}</button></div>}</section></main>;
}
