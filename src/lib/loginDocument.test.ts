import { describe, expect, it } from "vitest";
import {
  docToEmail,
  sanitizeDocumentNumber,
  type DocumentType,
} from "./loginDocument";

describe("loginDocument", () => {
  it.each<[DocumentType, string, string]>([
    ["dni", "12a34 567890", "12345678"],
    ["ce", "a123-456-7890", "123456789"],
  ])("normaliza y limita un documento %s", (type, input, expected) => {
    expect(sanitizeDocumentNumber(type, input)).toBe(expected);
  });

  it.each<[DocumentType, string, string]>([
    ["dni", "12345678", "dni-12345678@ugel06.gob.pe"],
    ["ce", "123456789", "ce-123456789@ugel06.gob.pe"],
  ])("genera el identificador de acceso para %s", (type, input, expected) => {
    expect(docToEmail(type, input)).toBe(expected);
  });

  it("distingue un campo vacío de un documento inválido", () => {
    expect(() => docToEmail("dni", "")).toThrow("Ingresa tu número de DNI");
  });

  it("rechaza caracteres no numéricos", () => {
    expect(() => docToEmail("ce", "123A56789")).toThrow(
      "El número de CE solo debe contener dígitos",
    );
  });

  it.each<[DocumentType, string, number]>([
    ["dni", "1234567", 8],
    ["ce", "12345678", 9],
  ])("valida la longitud de %s", (type, input, length) => {
    expect(() => docToEmail(type, input)).toThrow(
      `debe tener ${length} dígitos`,
    );
  });
});
