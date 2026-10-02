import { describe, expect, it } from "vitest";
import { sanitizeOrTerm } from "./postgrestSearch";

describe("sanitizeOrTerm", () => {
  it("neutraliza separadores y comodines de PostgREST", () => {
    expect(sanitizeOrTerm("a,b(c)d.e*f%g\\h\"i")).toBe("a_b_c_d_e_f_g_h_i");
  });

  it("colapsa espacios y recorta", () => {
    expect(sanitizeOrTerm("  san   juan ")).toBe("san juan");
  });

  it("no altera términos normales", () => {
    expect(sanitizeOrTerm("0123456")).toBe("0123456");
  });
});
