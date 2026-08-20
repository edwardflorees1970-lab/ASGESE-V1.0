import { describe, expect, it } from "vitest";
import { directorPlazaKey, generateTemporaryPassword, isStrongPassword, normalizeInstitutionalCode, normalizeRei, schoolNamesAreSimilar, validateUserImportRows } from "./userImport";

const valid = {
  tipo_documento: "DNI", numero_documento: "01234567", apellido_paterno: "Perez",
  apellido_materno: "Lopez", nombres: "Ana", correo: "",
  fecha_nacimiento: "1990-01-02", codigo_institucional: "25642929",
  nombre_colegio_referencia: "IE PUBLICA JOSE OLAYA", modalidad: "EBR", rol: "director_iiee", can_create_monitoreo: "NO",
};

const vacantPlaza = {
  id: "11111111-1111-1111-1111-111111111111", codigoInstitucional: "25642929",
  institucionNombre: "I.E. PÚBLICA JOSÉ OLAYA", modalidad: "EBR", rei: "01",
  alias: "25642929.ebr@ugel06.gob.pe", estado: "VACANTE" as const,
};
const plazas = new Map([[directorPlazaKey("25642929", "EBR"), vacantPlaza]]);

describe("validateUserImportRows", () => {
  it("preserves leading zeroes and accepts active roles", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: valid }], new Set(["director_iiee"]), new Set(), new Set(), plazas);
    expect(row.status).toBe("valid");
    expect(row.numero_documento).toBe("01234567");
    expect(row.can_create_monitoreo).toBe(false);
    expect(row.apellido_paterno).toBe("PEREZ");
    expect(row.apellido_materno).toBe("LOPEZ");
    expect(row.nombres).toBe("ANA");
    expect(row.correo).toBe("25642929.ebr@ugel06.gob.pe");
    expect(row.rei).toBe("01");
    expect(row.plaza_id).toBe(vacantPlaza.id);
  });

  it("detects file and database duplicates", () => {
    const rows = validateUserImportRows([
      { sourceRow: 2, values: valid }, { sourceRow: 3, values: { ...valid, nombres: "Otra" } },
    ], new Set(["director_iiee"]), new Set(["25642929.ebr@ugel06.gob.pe"]), new Set(), plazas);
    expect(rows[0].errors).toContain("Correo duplicado en el archivo");
    expect(rows[0].errors).toContain("Correo ya registrado");
    expect(rows[1].status).toBe("invalid");
  });

  it("rejects invalid dates, flags and roles", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, correo: "ana@ugel06.gob.pe", codigo_institucional: "", nombre_colegio_referencia: "", modalidad: "", fecha_nacimiento: "02/01/1990", rol: "missing", can_create_monitoreo: "quizas" } }], new Set(["user"]));
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

  it("requires an existing vacant plaza for Director IIEE", () => {
    const [validDirector] = validateUserImportRows([{ sourceRow: 2, values: valid }], new Set(["director_iiee"]), new Set(), new Set(), plazas);
    expect(validDirector.status).toBe("valid");
    expect(validDirector.institucion_nombre).toBe("I.E. PÚBLICA JOSÉ OLAYA");

    const [missing] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, codigo_institucional: "87654321" } }], new Set(["director_iiee"]), new Set(), new Set(), plazas);
    expect(missing.errors).toContain("No existe una plaza para el código institucional y modalidad");

    const occupied = new Map([[directorPlazaKey("25642929", "EBR"), { ...vacantPlaza, estado: "OCUPADA" as const }]]);
    const [occupiedDirector] = validateUserImportRows([{ sourceRow: 2, values: valid }], new Set(["director_iiee"]), new Set(), new Set(), occupied);
    expect(occupiedDirector.errors).toContain("La plaza ya está ocupada");
  });

  it("rejects the field for roles other than Director IIEE", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, correo: "ana@ugel06.gob.pe", rol: "user" } }], new Set(["user"]));
    expect(row.errors).toContain("Los datos de plaza solo corresponden al rol Director IIEE");
  });

  it("uses the official alias and REI and only warns about reference differences", () => {
    const [row] = validateUserImportRows([{ sourceRow: 2, values: { ...valid, correo: "otro@ugel06.gob.pe", rei: "02", nombre_colegio_referencia: "OTRO COLEGIO", can_create_monitoreo: "SI" } }], new Set(["director_iiee"]), new Set(), new Set(), plazas);
    expect(row.status).toBe("valid");
    expect(row.correo).toBe(vacantPlaza.alias);
    expect(row.rei).toBe("01");
    expect(row.can_create_monitoreo).toBe(false);
    expect(row.warnings.length).toBeGreaterThanOrEqual(3);
    expect(schoolNamesAreSimilar("IE PUBLICA JOSE OLAYA", "I.E. PÚBLICA JOSÉ OLAYA")).toBe(true);
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
