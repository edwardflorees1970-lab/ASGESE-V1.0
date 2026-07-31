import { describe, expect, it } from "vitest";
import { daysFromToday, isMonitoreoExpired } from "./monitoreoVigencia";

describe("monitoreoVigencia", () => {
  it("treats a monitoring as active through its end date", () => {
    expect(isMonitoreoExpired("2026-07-31", "2026-07-31")).toBe(false);
    expect(isMonitoreoExpired("2026-08-01", "2026-07-31")).toBe(false);
  });

  it("detects expiration using date-only semantics", () => {
    expect(isMonitoreoExpired("2026-07-30", "2026-07-31")).toBe(true);
    expect(isMonitoreoExpired(null, "2026-07-31")).toBe(false);
  });

  it("calculates signed day differences without timezone drift", () => {
    expect(daysFromToday("2026-08-02", "2026-07-31")).toBe(2);
    expect(daysFromToday("2026-07-30", "2026-07-31")).toBe(-1);
    expect(daysFromToday(undefined, "2026-07-31")).toBeNull();
  });
});
