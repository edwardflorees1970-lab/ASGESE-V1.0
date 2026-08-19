import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, isStrongPassword, normalizeInstitutionalCode, normalizeRei, validateUserImportRows } from "./userImport";

const valid = {
  tipo_documento: "DNI", numero_documento: "01234567", apellido_paterno: "Perez",
  apellido_materno: "Lopez", nombres: "Ana", correo: "ana@ugel06.gob.pe",
  fecha_nacimiento: "1990-01-02", codigo_institucional: "25642929", rol: "director_iiee", can_create_monitoreo: "NO",
};

describe("validateUserImportRows", () => {
  it("preserves leading zeroes and accepts active roles", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: valid }], new Set(["director_iiee"]));
    expect(row.status).toBe("valid");
    expect(row.numero_documento).toBe("01234567");
    expect(row.can_create_monitoreo).toBe(false);
    expect(row.apellido_paterno).toBe("PEREZ");
    expect(row.apellido_materno).toBe("LOPEZ");
    expect(row.nombres).toBe("ANA");
  });

  it("detects file and database duplicates", () => {
    const rows = validateUserImportRows([
      { sourceRow: 2, values: valid }, { sourceRow: 3, values: { ...valid, nombres: "Otra" } },
    ], new Set(["director_iiee"]), new Set(["ana@ugel06.gob.pe"]));
    expect(rows[0].errors).toContain("Correo duplicado en el archivo");
    expect(rows[0].errors).toContain("Correo ya registrado");
    expect(rows[1].status).toBe("invalid");
  });

  it("rejects invalid dates, flags and roles", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, fecha_nacimiento: "02/01/1990", rol: "missing", can_create_monitoreo: "quizas" } }], new Set(["user"]));
    expect(row.errors).toEqual(expect.arrayContaining(["Fecha inválida; usa AAAA-MM-DD", "Rol inexistente o inactivo", "can_create_monitoreo debe ser SI o NO"]));
  });
});

describe("temporary passwords", () => {
  it("generates the agreed surname password", () => {
    expect(generateTemporaryPassword("QUISPE")).toBe("Quispe123@@");
    expect(isStrongPassword("Quispe123@@")).toBe(true);
  });

  it("supports compound surnames and enforces every character group", () => {
    expect(generateTemporaryPassword("DE LA CRUZ")).toBe("DeLaCruz123@@");
    expect(isStrongPassword("quispe123@@")).toBe(false);
    expect(isStrongPassword("Quispe@@@@")).toBe(false);
  });
});

describe("institutional code", () => {
  it("preserves a leading zero and restores it when Excel provides a number", () => {
    expect(normalizeInstitutionalCode("01234567")).toBe("01234567");
    expect(normalizeInstitutionalCode(1234567)).toBe("01234567");
  });

  it("requires an existing public institution for Director IIEE", () => {
    const publicCodes = new Map([["25642929", { name: "IE PÚBLICA", isPublic: true }]]);
    const [validDirector] = validateUserImportRows([{ sourceRow: 2, values: valid }], new Set(["director_iiee"]), new Set(), new Set(), publicCodes);
    expect(validDirector.status).toBe("valid");
    expect(validDirector.institucion_nombre).toBe("IE PÚBLICA");

    const [missing] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, codigo_institucional: "87654321" } }], new Set(["director_iiee"]), new Set(), new Set(), publicCodes);
    expect(missing.errors).toContain("Código institucional no registrado");

    const privateCodes = new Map([["25642929", { name: "IE PRIVADA", isPublic: false }]]);
    const [privateInstitution] = validateUserImportRows([{ sourceRow: 2, values: valid }], new Set(["director_iiee"]), new Set(), new Set(), privateCodes);
    expect(privateInstitution.errors).toContain("El código institucional no pertenece a un colegio público");
  });

  it("rejects the field for roles other than Director IIEE", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, rol: "user" } }], new Set(["user"]));
    expect(row.errors).toContain("Código institucional solo corresponde al rol Director IIEE");
  });
});

describe("normalizeRei", () => {
  it("normalizes accepted REI variants to two digits", () => {
    expect(normalizeRei("1")).toBe("01");
    expect(normalizeRei("REI 1")).toBe("01");
    expect(normalizeRei("rei 09")).toBe("09");
    expect(normalizeRei("19")).toBe("19");
    expect(normalizeRei(2)).toBe("02");
  });

  it("accepts SIN REI and rejects values outside the catalog", () => {
    expect(normalizeRei("")).toBe("SIN REI");
    expect(normalizeRei("SIN REI")).toBe("SIN REI");
    expect(normalizeRei("20")).toBeNull();
    expect(normalizeRei("REI X")).toBeNull();
  });
});
