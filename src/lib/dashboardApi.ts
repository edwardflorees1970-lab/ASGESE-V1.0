import { supabase } from "./supabaseClient";
import { isMissingRpc } from "./rpcErrors";

export type DashboardRunFact = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  template_id?: string;
  run_count: number;
};

const PAGE_SIZE = 1000;

export async function loadDashboardRunFacts(input: {
  from: Date;
  to: Date;
  isTest: boolean;
  templateIds: string[] | null;
}): Promise<DashboardRunFact[]> {
  if (input.templateIds?.length === 0) return [];
  const { data, error } = await supabase.rpc("dashboard_run_facts", {
    p_from: input.from.toISOString(),
    p_to: input.to.toISOString(),
    p_is_test: input.isTest,
    p_template_ids: input.templateIds,
  });
  if (!error) {
    return ((data ?? []) as Array<Omit<DashboardRunFact, "run_count"> & { run_count: number | string }>).map((row) => ({
      ...row,
      run_count: Number(row.run_count) || 0,
    }));
  }
  if (!isMissingRpc(error)) throw new Error(error.message);

  // Compatibilidad temporal mientras se aplica la migracion en cada ambiente.
  const rows: DashboardRunFact[] = [];
  for (let fromRow = 0; ; fromRow += PAGE_SIZE) {
    let query = supabase
      .from("form_run")
      .select("id, status, created_by, created_at, template_id")
      .gte("created_at", input.from.toISOString())
      .lt("created_at", input.to.toISOString())
      .eq("is_test", input.isTest)
      .neq("status", "borrador")
      .order("created_at", { ascending: false })
      .range(fromRow, fromRow + PAGE_SIZE - 1);
    if (input.templateIds) query = query.in("template_id", input.templateIds);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as Omit<DashboardRunFact, "run_count">[];
    rows.push(...page.map((row) => ({ ...row, run_count: 1 })));
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

