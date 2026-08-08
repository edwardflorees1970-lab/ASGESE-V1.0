import { useEffect, useState } from "react";
import { useAuth } from "../app/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { canSeeAllRole } from "../lib/roles";
import { daysFromToday, todayDateOnly } from "../lib/monitoreoVigencia";

const NOTICE_DURATION_SECONDS = 30;
const UPCOMING_DAYS = 7;

type ExpiringMonitoring = {
  id: string;
  nombre: string;
  codigo: string;
  fecha_fin: string;
};

function addDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
}

export function SessionExpiryNotice() {
  const { user, session, profile, profileLoading } = useAuth();
  const [items, setItems] = useState<ExpiringMonitoring[]>([]);
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(NOTICE_DURATION_SECONDS);

  const noticeKey = user?.id && session?.access_token
    ? `agebre:expiry-notice:${user.id}:${session.access_token.slice(-12)}`
    : null;

  useEffect(() => {
    let alive = true;
    if (!noticeKey || !profile?.id || profileLoading || sessionStorage.getItem(noticeKey)) return;

    (async () => {
      const today = todayDateOnly();
      const lastDay = addDays(today, UPCOMING_DAYS);
      let allowedIds: string[] | null = null;

      if (!canSeeAllRole(profile.role)) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from("monitoreo_asignacion")
          .select("monitoreo_id")
          .eq("user_id", profile.id);
        if (assignmentsError || !alive) return;
        allowedIds = (assignments ?? []).map((row) => row.monitoreo_id).filter(Boolean);
        if (!allowedIds.length) {
          sessionStorage.setItem(noticeKey, "empty");
          return;
        }
      }

      let query = supabase
        .from("monitoreo_catalog")
        .select("id, nombre, codigo, fecha_fin")
        .eq("is_active", true)
        .gte("fecha_fin", today)
        .lte("fecha_fin", lastDay)
        .order("fecha_fin", { ascending: true });
      if (allowedIds) query = query.in("id", allowedIds);

      const { data, error } = await query;
      if (!alive || error) return;
      sessionStorage.setItem(noticeKey, data?.length ? "shown" : "empty");
      if (!data?.length) return;
      setItems(data as ExpiringMonitoring[]);
      setSecondsLeft(NOTICE_DURATION_SECONDS);
      setOpen(true);
    })();

    return () => {
      alive = false;
    };
  }, [noticeKey, profile?.id, profile?.role, profileLoading]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setOpen(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open || !items.length) return null;

  return (
    <section className="expiry-notice" role="dialog" aria-modal="false" aria-labelledby="expiry-notice-title">
      <div className="expiry-notice-header">
        <div className="expiry-notice-icon" aria-hidden="true">!</div>
        <div className="min-w-0 flex-1">
          <div className="expiry-notice-eyebrow">Aviso de vigencia</div>
          <h2 id="expiry-notice-title">Monitoreos próximos a vencer</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="expiry-notice-close" aria-label="Cerrar aviso">×</button>
      </div>
      <p className="expiry-notice-description">
        Revisa estos monitoreos para evitar interrupciones en el registro de fichas.
      </p>
      <div className="expiry-notice-list">
        {items.slice(0, 5).map((item) => {
          const days = daysFromToday(item.fecha_fin) ?? 0;
          return (
            <div key={item.id} className="expiry-notice-item">
              <div className="min-w-0">
                <strong>{item.nombre}</strong>
                <span>{item.codigo} · {formatDate(item.fecha_fin)}</span>
              </div>
              <span className="expiry-notice-days">{days === 0 ? "Hoy" : `${days} d`}</span>
            </div>
          );
        })}
        {items.length > 5 && <div className="expiry-notice-more">Y {items.length - 5} monitoreo(s) adicional(es)</div>}
      </div>
      <div className="expiry-notice-timer">
        <div className="expiry-notice-timer-label"><span>Cierre automático</span><strong aria-live="polite">{secondsLeft} s</strong></div>
        <div className="expiry-notice-track"><div style={{ width: `${(secondsLeft / NOTICE_DURATION_SECONDS) * 100}%` }} /></div>
      </div>
    </section>
  );
}
