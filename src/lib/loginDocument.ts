export type DocumentType = "dni" | "ce";

export const DOCUMENT_LENGTH: Record<DocumentType, number> = {
  dni: 8,
  ce: 9,
};

const getDocumentLabel = (type: DocumentType) => (type === "dni" ? "DNI" : "CE");

export function sanitizeDocumentNumber(type: DocumentType, value: string) {
  return value.replace(/\D/g, "").slice(0, DOCUMENT_LENGTH[type]);
}

export function docToEmail(type: DocumentType, value: string) {
  const normalized = value.trim();
  const label = getDocumentLabel(type);

  if (!normalized) {
    throw new Error(`Ingresa tu número de ${label}`);
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`El número de ${label} solo debe contener dígitos`);
  }

  if (normalized.length !== DOCUMENT_LENGTH[type]) {
    throw new Error(
      `El número de ${label} debe tener ${DOCUMENT_LENGTH[type]} dígitos`,
    );
  }

  return `${type}-${normalized}@ugel06.gob.pe`.toLowerCase();
}
