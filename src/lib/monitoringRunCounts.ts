import { supabase } from "./supabaseClient";
import { isMissingRpc } from "./rpcErrors";

type MonitoringRunCountRow = {
  monitoreo_id: string | null;
  run_count: number | string | null;
};

function normalizeCounts(rows: MonitoringRunCountRow[]) {
  return Object.fromEntries(
    rows
      .filter((row): row is MonitoringRunCountRow & { monitoreo_id: string } => Boolean(row.monitoreo_id))
      .map((row) => [row.monitoreo_id, Number(row.run_count ?? 0)]),
  );
}

export async function loadMonitoringRunCounts(monitoreoIds: string[], isTestMode: boolean) {
  if (!monitoreoIds.length) return {} as Record<string, number>;

  const { data, error } = await supabase.rpc("monitoring_registered_run_counts", {
    p_monitoreo_ids: monitoreoIds,
    p_is_test: isTestMode,
  });

  if (!error) return normalizeCounts((data ?? []) as MonitoringRunCountRow[]);
  if (!isMissingRpc(error)) throw new Error(error.message);

  // Compatibilidad mientras se aplica la migración: cuenta toda ejecución
  // registrada en BD, incluidos los registros del responsable CdD, y excluye
  // únicamente los borradores incompletos.
  const results = await Promise.all(
    monitoreoIds.map(async (monitoreoId) => {
      const { count, error: countError } = await supabase
        .from("form_run")
        .select("id", { count: "exact", head: true })
        .eq("monitoreo_id", monitoreoId)
        .eq("is_test", isTestMode)
        .neq("status", "borrador");

      if (countError) throw new Error(countError.message);
      return [monitoreoId, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(results);
}

export async function loadCddRegisteredRunCount(monitoreoIds: string[], isTestMode: boolean) {
  if (!monitoreoIds.length) return 0;

  const { data, error } = await supabase.rpc("monitoring_cdd_registered_run_count", {
    p_monitoreo_ids: monitoreoIds,
    p_is_test: isTestMode,
  });
  if (!error) return Number(data ?? 0);
  if (!isMissingRpc(error)) throw new Error(error.message);

  const { data: cddProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "responsable_cdd");
  if (profilesError) throw new Error(profilesError.message);
  const cddIds = (cddProfiles ?? []).map((profile) => profile.id);
  if (!cddIds.length) return 0;

  const { count, error: countError } = await supabase
    .from("form_run")
    .select("id", { count: "exact", head: true })
    .in("monitoreo_id", monitoreoIds)
    .in("created_by", cddIds)
    .eq("is_test", isTestMode)
    .neq("status", "borrador");
  if (countError) throw new Error(countError.message);
  return count ?? 0;
}
