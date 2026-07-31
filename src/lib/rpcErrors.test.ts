import { describe, expect, it } from "vitest";
import { isMissingRpc } from "./rpcErrors";

describe("isMissingRpc", () => {
  it("detecta una funcion ausente en la cache de PostgREST", () => {
    expect(isMissingRpc({ code: "PGRST202", message: "not found" })).toBe(true);
    expect(isMissingRpc({ message: "Could not find the function in the schema cache" })).toBe(true);
  });

  it("no oculta errores reales de permisos o datos", () => {
    expect(isMissingRpc({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingRpc(null)).toBe(false);
  });
});
