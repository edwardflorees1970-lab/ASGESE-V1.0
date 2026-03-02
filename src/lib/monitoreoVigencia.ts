export function todayDateOnly() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isMonitoreoExpired(fechaFin?: string | null, refDate = todayDateOnly()) {
  if (!fechaFin) return false;
  return fechaFin < refDate;
}

export function daysFromToday(fechaFin?: string | null, refDate = todayDateOnly()) {
  if (!fechaFin) return null;
  const toUtc = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  const ms = toUtc(fechaFin) - toUtc(refDate);
  return Math.round(ms / 86400000);
}
