import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, clearLegacyAuthStorage } from "../lib/supabaseClient";
import logoAgebreUrl from "../assets/logoagebresf.png";
import {
  DOCUMENT_LENGTH,
  docToEmail,
  sanitizeDocumentNumber,
  type DocumentType,
} from "../lib/loginDocument";
import { TurnstileWidget, type TurnstileWidgetHandle } from "../components/auth/TurnstileWidget";

type LoginMode = "usuario" | "admin";

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const turnstileEnabled = import.meta.env.VITE_TURNSTILE_ENABLED === "true"
  || (import.meta.env.DEV && import.meta.env.VITE_TURNSTILE_ENABLED !== "false");
const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : "")).trim();

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

function LoginFieldIcon({ name }: { name: "mail" | "document" | "lock" }) {
  if (name === "mail") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
  }
  if (name === "document") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h5M8 16h7" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>;
}

function LoginFeatureIcon({ name }: { name: "monitor" | "tracking" | "reports" }) {
  if (name === "monitor") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6V7H9zM8 11h8M8 15h5" /></svg>;
  }
  if (name === "tracking") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 18V6M4 18h16M7 14l4-4 3 2 5-6" /><circle cx="7" cy="14" r="1" /><circle cx="11" cy="10" r="1" /><circle cx="14" cy="12" r="1" /><circle cx="19" cy="6" r="1" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 20V10M10 20V4M15 20v-7M20 20V7" /><path d="M3 20h19" /></svg>;
}

export function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>("usuario");
  const [correo, setCorreo] = useState("");
  const [tipoDoc, setTipoDoc] = useState<DocumentType>("dni");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileWidgetHandle>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const documentLength = DOCUMENT_LENGTH[tipoDoc];

  const changeMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setErrorMsg(null);
  };

  const changeDocumentType = (nextType: DocumentType) => {
    setTipoDoc(nextType);
    setNumeroDoc((current) => sanitizeDocumentNumber(nextType, current));
    setErrorMsg(null);
  };

  const changeDocumentNumber = (value: string) => {
    setNumeroDoc(sanitizeDocumentNumber(tipoDoc, value));
    setErrorMsg(null);
  };

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError(null);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken("");
    setCaptchaError("La verificación venció. Complétala nuevamente.");
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken("");
    setCaptchaError("No se pudo completar la verificación de seguridad. Intenta nuevamente.");
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    setErrorMsg(null);
    if (turnstileEnabled && !turnstileSiteKey) {
      setErrorMsg("La verificación de seguridad no está configurada.");
      return;
    }
    if (turnstileEnabled && !captchaToken) {
      setErrorMsg("Completa la verificación de seguridad antes de ingresar.");
      return;
    }
    setLoading(true);

    try {
      const email =
        mode === "usuario"
          ? correo.trim().toLowerCase()
          : docToEmail(tipoDoc, numeroDoc);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Ingresa un correo válido");
      }
      if (!password) throw new Error("Ingresa tu contraseña");

      // Solo limpia legado, no borra la sesión real.
      clearLegacyAuthStorage();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: turnstileEnabled ? { captchaToken } : undefined,
      });

      if (error) {
        const msg =
          /captcha/i.test(error.message)
            ? "No se pudo validar la verificación de seguridad. Intenta nuevamente."
            : error.message.includes("Invalid login credentials")
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
      if (turnstileEnabled) {
        setCaptchaToken("");
        captchaRef.current?.reset();
      }
    }
  };

  return (
    <div className="login-shell grid min-h-[100dvh] bg-[#07111f] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="login-brand-panel relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-xl">
              <img src={logoAgebreUrl} alt="ASGESE" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-[0.04em] text-white">ASGESE</p>
              <p className="login-brand-accent text-[11px] font-semibold uppercase tracking-[0.2em]">Monitoreo integral</p>
            </div>
          </div>

          <div className="mt-16 max-w-2xl">
            <p className="login-brand-accent text-xs font-bold uppercase tracking-[0.22em]">Plataforma institucional · UGEL 06</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-white xl:text-5xl">Seguimiento educativo con información clara y confiable.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">Gestiona monitoreos, consolida resultados y convierte cada registro en evidencia útil para la toma de decisiones.</p>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-3">
          {([
            ["monitor", "Monitoreo", "Registro ordenado"],
            ["tracking", "Seguimiento", "Trazabilidad operativa"],
            ["reports", "Reportes", "Información ejecutiva"],
          ] as const).map(([icon, title, detail]) => (
            <div key={icon} className="login-brand-feature rounded-2xl border p-4">
              <span className="login-brand-feature-icon"><LoginFeatureIcon name={icon} /></span>
              <p className="mt-3 text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="login-access-panel flex items-start justify-center px-5 py-3 sm:px-10 sm:py-4 lg:items-center lg:px-12 lg:py-8">
        <div className="w-full max-w-md">
          <div className="mb-4 flex items-center gap-2.5 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm">
              <img src={logoAgebreUrl} alt="ASGESE" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-base font-bold tracking-[0.025em] text-[var(--app-text)]">ASGESE</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[var(--app-accent)]">UGEL 06</p>
            </div>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[var(--app-accent)] sm:text-xs">Acceso seguro</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-[-0.025em] text-[var(--app-text)] sm:text-[1.75rem]">Bienvenido nuevamente</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[var(--app-muted)] sm:text-sm sm:leading-6">Ingresa con las credenciales asignadas para acceder al sistema de monitoreo.</p>

          <div className="login-mode-switch mt-4 grid h-10 w-full max-w-[18rem] grid-cols-2 rounded-xl border p-1 sm:mt-5" role="group" aria-label="Tipo de acceso">
            <button type="button" aria-pressed={mode === "usuario"} onClick={() => changeMode("usuario")} className="login-mode-option rounded-lg px-3 text-[13px] font-semibold">Monitor</button>
            <button type="button" aria-pressed={mode === "admin"} onClick={() => changeMode("admin")} className="login-mode-option rounded-lg px-3 text-[13px] font-semibold">Administrador</button>
          </div>

          <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
            <div key={mode} className="login-credential-panel">
              {mode === "usuario" ? (
                <label className="block">
                  <span className="login-field-label">Correo</span>
                  <div className="relative">
                    <span className="login-field-icon"><LoginFieldIcon name="mail" /></span>
                    <input type="email" autoComplete="email" value={correo} onChange={(e) => { setCorreo(e.target.value); setErrorMsg(null); }} placeholder="nombre@correo.com" className="login-field pl-10" />
                  </div>
                </label>
              ) : (
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
                  <div>
                    <span className="login-field-label">Tipo</span>
                    <div className="login-document-switch grid h-11 grid-cols-2 rounded-xl border p-1 lg:h-12" role="group" aria-label="Tipo de documento">
                      <button type="button" aria-pressed={tipoDoc === "dni"} onClick={() => changeDocumentType("dni")} className="login-document-option rounded-lg text-sm font-semibold">DNI</button>
                      <button type="button" aria-pressed={tipoDoc === "ce"} onClick={() => changeDocumentType("ce")} className="login-document-option rounded-lg text-sm font-semibold">CE</button>
                    </div>
                  </div>

                  <label className="block">
                    <span className="login-field-label">Número de documento</span>
                    <div className="relative">
                      <span className="login-field-icon"><LoginFieldIcon name="document" /></span>
                      <input autoComplete="username" inputMode="numeric" pattern="[0-9]*" maxLength={documentLength} value={numeroDoc} onChange={(e) => changeDocumentNumber(e.target.value)} placeholder={tipoDoc === "dni" ? "Número de DNI" : "Número de CE"} aria-label={`Número de ${tipoDoc === "dni" ? "DNI" : "CE"}`} className="login-field pl-10" />
                    </div>
                  </label>
                </div>
              )}
            </div>

            <label className="block">
              <span className="login-field-label">Contraseña</span>
              <div className="relative">
                <span className="login-field-icon"><LoginFieldIcon name="lock" /></span>
                <input type={showPass ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrorMsg(null); }} placeholder="••••••••••" className="login-field px-10" />
                <button type="button" onClick={() => setShowPass((s) => !s)} title={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} className="login-password-toggle">
                  <EyeIcon closed={showPass} />
                </button>
              </div>
            </label>

            {turnstileEnabled && turnstileSiteKey && (
              <div className="login-turnstile-panel" aria-describedby="turnstile-status">
                <div className="login-turnstile-heading">
                  <span>Verificación de seguridad</span>
                  <span className={captchaToken ? "is-verified" : ""}>{captchaToken ? "Completada" : "Protección activa"}</span>
                </div>
                <TurnstileWidget
                  ref={captchaRef}
                  siteKey={turnstileSiteKey}
                  onVerify={handleCaptchaVerify}
                  onExpire={handleCaptchaExpire}
                  onError={handleCaptchaError}
                />
                <p id="turnstile-status" aria-live="polite" className={`login-turnstile-status ${captchaError ? "is-error" : ""}`}>
                  {captchaError ?? (captchaToken ? "Tu acceso está listo para validarse." : "Cloudflare comprobará el acceso sin solicitar datos personales.")}
                </p>
              </div>
            )}

            {errorMsg && <div role="alert" className="login-error-message rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">{errorMsg}</div>}

            <button type="button" onClick={handleLogin} disabled={loading || (turnstileEnabled && !captchaToken)} aria-busy={loading} className={`executive-primary-action login-submit-button mt-1 h-11 w-full rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 lg:h-12 ${loading ? "is-loading" : ""}`}>
              {loading && <span className="login-submit-spinner" aria-hidden="true" />}
              <span>{loading ? "Verificando acceso..." : "Ingresar al sistema"}</span>
            </button>
          </div>

          <div className="mt-4 border-t border-[var(--app-border)] pt-2 text-center text-[9px] leading-4 text-[var(--app-muted-2)] lg:mt-7 lg:pt-4 lg:text-[10px] lg:leading-5">
            <p>Acceso exclusivo para usuarios autorizados · ASGESE 2026</p>
            <p className="mt-1">Ing. Alex Alberto Quispe Pillaca · Ing. Diego Axel Arce Muñoz</p>
            <p>Propietario UGEL 06®</p>
          </div>
        </div>
      </section>
    </div>
  );
}
