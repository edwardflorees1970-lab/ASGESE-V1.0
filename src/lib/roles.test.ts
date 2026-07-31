import { describe, expect, it } from "vitest";
import { canManageOnlyAdmin, canSeeAllRole, isAdminRole, roleLabel } from "./roles";

describe("roles", () => {
  it("limits administrator-only actions", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(canManageOnlyAdmin("admin")).toBe(true);
    expect(canManageOnlyAdmin("director")).toBe(false);
    expect(canManageOnlyAdmin("user")).toBe(false);
  });

  it.each(["admin", "jefe_area", "director"])("grants global visibility to %s", (role) => {
    expect(canSeeAllRole(role)).toBe(true);
  });

  it.each(["user", "responsable_cdd", null, undefined])(
    "does not grant global visibility to %s",
    (role) => {
      expect(canSeeAllRole(role)).toBe(false);
    },
  );

  it("provides stable user-facing labels", () => {
    expect(roleLabel("admin")).toBe("Administrador");
    expect(roleLabel("jefe_area")).toBe("Jefe de area");
    expect(roleLabel("director")).toBe("Director(a)");
    expect(roleLabel("responsable_cdd")).toBe("Responsable CdD");
    expect(roleLabel("user")).toBe("Monitor");
  });
});
