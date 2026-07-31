import { describe, expect, it } from "vitest";
import {
  createHeaderField,
  normalizeCustomHeaderValues,
  normalizeHeaderConfig,
  normalizeHeaderFields,
} from "./dynamicHeader";

describe("dynamic header", () => {
  it("normalizes custom field definitions and removes invalid entries", () => {
    const fields = normalizeHeaderFields([
      { id: "one", label: "Número de aula", type: "number", required: true },
      null,
      { id: "two", label: "Turno", type: "select", options: ["Mañana", "", "Tarde"] },
    ]);

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ key: "numero_de_aula", type: "number", required: true });
    expect(fields[1]?.options).toEqual(["Mañana", "Tarde"]);
  });

  it("keeps generated keys unique", () => {
    const fields = normalizeHeaderFields([
      { id: "one", label: "Director" },
      { id: "two", label: "Director" },
    ]);
    expect(fields[0]?.key).toBe("director");
    expect(fields[1]?.key).toBe("director_x");
  });

  it("merges defaults and normalizes arrays", () => {
    const config = normalizeHeaderConfig({
      institucion: false,
      area_options: [" Pedagogía ", ""],
      field_order: [" rei ", ""],
      custom_fields: [{ id: "one", label: "Director" }],
    });
    expect(config.institucion).toBe(false);
    expect(config.codigo_modular).toBe(true);
    expect(config.area_options).toEqual(["Pedagogía"]);
    expect(config.field_order).toEqual(["rei"]);
    expect(config.custom_fields).toHaveLength(1);
  });

  it("serializes only known custom values", () => {
    const field = createHeaderField({ id: "one", key: "director", label: "Director" });
    expect(normalizeCustomHeaderValues([field], { director: "Ada", ignored: "value" })).toEqual({
      director: "Ada",
    });
    expect(normalizeCustomHeaderValues([field], null)).toEqual({ director: "" });
  });
});
