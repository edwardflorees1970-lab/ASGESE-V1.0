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

function daysLabel(days: number) {
  return days <= 0 ? "Hoy" : `${days} d`;
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

  const first = items[0];
  const firstDays = daysFromToday(first.fecha_fin) ?? 0;
  const summary = items.length === 1
    ? `${first.nombre} vence en ${firstDays <= 0 ? "menos de un día" : `${firstDays} día${firstDays === 1 ? "" : "s"}`}.`
    : `${items.length} monitoreos vencen en los próximos ${UPCOMING_DAYS} días.`;
  const ringPct = Math.round((secondsLeft / NOTICE_DURATION_SECONDS) * 100);

  return (
    <section className="expiry-toast" role="status" aria-live="polite" aria-label="Aviso de vigencia">
      <div className="expiry-toast-row">
        <div className="expiry-toast-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path d="M8 14.5h2M8 17.5h5" /></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="expiry-toast-title">Vigencia próxima</div>
          <p className="expiry-toast-text">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="expiry-toast-ring"
          style={{ "--expiry-ring-pct": `${ringPct}%` } as React.CSSProperties}
          aria-label={`Cerrar aviso (cierre automático en ${secondsLeft} s)`}
        >
          <span className="expiry-toast-ring-inner">×</span>
        </button>
      </div>
      {items.length > 1 && (
        <div className="expiry-toast-chips">
          {items.slice(0, 4).map((item) => (
            <span key={item.id} className="expiry-toast-chip" title={item.nombre}>
              {item.codigo} · {daysLabel(daysFromToday(item.fecha_fin) ?? 0)}
            </span>
          ))}
          {items.length > 4 && <span className="expiry-toast-chip expiry-toast-chip-muted">+{items.length - 4}</span>}
        </div>
      )}
    </section>
  );
}
