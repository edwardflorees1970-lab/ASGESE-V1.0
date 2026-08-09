import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("./supabaseClient", () => ({
  supabase: { rpc },
}));

import { loadDashboardRunFacts } from "./dashboardApi";

const baseInput = {
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2027-01-01T00:00:00.000Z"),
  isTest: false,
  templateIds: null,
  viewerId: "monitor-1",
};

describe("loadDashboardRunFacts", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: [
        { id: "run-1", status: "final", created_by: "monitor-1", created_at: "2026-05-01", template_id: "template-1", run_count: "2" },
        { id: "run-2", status: "final", created_by: "monitor-2", created_at: "2026-05-01", template_id: "template-1", run_count: 3 },
      ],
      error: null,
    });
  });

  it("keeps only the authenticated monitor facts in personal scope", async () => {
    const rows = await loadDashboardRunFacts({ ...baseInput, canSeeAll: false });

    expect(rows).toEqual([
      expect.objectContaining({ id: "run-1", created_by: "monitor-1", run_count: 2 }),
    ]);
  });

  it("keeps the consolidated facts for privileged roles", async () => {
    const rows = await loadDashboardRunFacts({ ...baseInput, canSeeAll: true });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.run_count)).toEqual([2, 3]);
  });
});
