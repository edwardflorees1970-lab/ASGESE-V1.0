import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, isStrongPassword, validateUserImportRows } from "./userImport";

const valid = {
  tipo_documento: "DNI", numero_documento: "01234567", apellido_paterno: "Perez",
  apellido_materno: "Lopez", nombres: "Ana", correo: "ana@ugel06.gob.pe",
  fecha_nacimiento: "1990-01-02", rol: "director_iiee", can_create_monitoreo: "NO",
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
