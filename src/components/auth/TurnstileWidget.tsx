import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const SCRIPT_ID = "cloudflare-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileConfiguration = {
  sitekey: string;
  action: string;
  theme: "auto";
  size: "flexible";
  appearance: "always";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": (code: string) => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, configuration: TurnstileConfiguration) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const handleLoad = () => window.turnstile ? resolve() : reject(new Error("Turnstile no quedó disponible."));
    const handleError = () => reject(new Error("No se pudo cargar Turnstile."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export type TurnstileWidgetHandle = { reset: () => void };

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}>(function TurnstileWidget({ siteKey, onVerify, onExpire, onError }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "agebre_login",
          theme: "auto",
          size: "flexible",
          appearance: "always",
          callback: onVerify,
          "expired-callback": onExpire,
          "error-callback": () => onError(),
        });
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [onError, onExpire, onVerify, siteKey]);

  return <div ref={containerRef} className="login-turnstile-widget" aria-label="Verificación de seguridad Cloudflare Turnstile" />;
});
