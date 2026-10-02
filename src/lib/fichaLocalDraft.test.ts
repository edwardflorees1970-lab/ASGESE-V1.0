import { describe, expect, it } from "vitest";
import { isLocalDraftUsable, readLocalDraft } from "./fichaLocalDraft";

describe("isLocalDraftUsable", () => {
  const base = "2026-10-02T10:00:00.000Z";
  const later = "2026-10-02T11:00:00.000Z";

  it("acepta un snapshot de ficha nueva cuando no hay registro en servidor", () => {
    expect(isLocalDraftUsable({ runId: null, serverUpdatedAt: null }, null)).toBe(true);
  });

  it("descarta un snapshot de un registro que ya no está como borrador", () => {
    expect(isLocalDraftUsable({ runId: "r1", serverUpdatedAt: base }, null)).toBe(false);
  });

  it("acepta cuando el servidor no cambió desde la base del snapshot", () => {
    expect(isLocalDraftUsable({ runId: "r1", serverUpdatedAt: base }, { id: "r1", version: base })).toBe(true);
  });

  it("descarta cuando el servidor tiene una versión más nueva", () => {
    expect(isLocalDraftUsable({ runId: "r1", serverUpdatedAt: base }, { id: "r1", version: later })).toBe(false);
  });

  it("descarta snapshots de otro registro o sin versión base", () => {
    expect(isLocalDraftUsable({ runId: "r2", serverUpdatedAt: later }, { id: "r1", version: base })).toBe(false);
    expect(isLocalDraftUsable({ runId: null, serverUpdatedAt: null }, { id: "r1", version: base })).toBe(false);
    expect(isLocalDraftUsable({ runId: "r1" }, { id: "r1", version: base })).toBe(false);
  });

  it("sin versión en servidor solo acepta el mismo registro sin base", () => {
    expect(isLocalDraftUsable({ runId: "r1", serverUpdatedAt: null }, { id: "r1", version: null })).toBe(true);
    expect(isLocalDraftUsable({ runId: null, serverUpdatedAt: null }, { id: "r1", version: null })).toBe(false);
  });
});

describe("readLocalDraft", () => {
  it("devuelve el snapshot válido y borra el corrupto", () => {
    localStorage.setItem("k1", JSON.stringify({ runId: null, header: {}, footer: {}, answers: {}, updatedAt: "x" }));
    expect(readLocalDraft(localStorage, "k1")?.updatedAt).toBe("x");
    localStorage.setItem("k2", "{no-json");
    expect(readLocalDraft(localStorage, "k2")).toBeNull();
    expect(localStorage.getItem("k2")).toBeNull();
    expect(readLocalDraft(localStorage, "missing")).toBeNull();
  });
});
