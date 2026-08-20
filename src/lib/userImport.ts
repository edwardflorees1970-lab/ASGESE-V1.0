export const USER_IMPORT_HEADERS = [
  "tipo_documento", "numero_documento", "apellido_paterno", "apellido_materno",
  "nombres", "correo", "telefono", "fecha_nacimiento", "cargo", "area",
  "comision", "ugel", "rei", "codigo_institucional", "nombre_colegio_referencia",
  "modalidad", "rol", "can_create_monitoreo",
] as const;

export type UserImportInput = {
  source_row: number;
  tipo_documento: "DNI" | "CE";
  numero_documento: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  correo: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  cargo: string | null;
  area: string | null;
  comision: string | null;
  ugel: string | null;
  rei: string | null;
  codigo_institucional: string | null;
  nombre_colegio_referencia: string | null;
  modalidad: string | null;
  plaza_id: string | null;
  rol: string;
  can_create_monitoreo: boolean;
};

export type UserImportPreviewRow = UserImportInput & {
  institucion_nombre: string | null;
  errors: string[];
  warnings: string[];
  status: "valid" | "invalid";
};

export type UserImportResultRow = {
  source_row: number;
  correo: string;
  numero_documento: string;
  nombres: string;
  status: "created" | "skipped" | "error";
  message: string;
  temporary_password?: string;
  codigo_institucional?: string | null;
  institucion_nombre?: string | null;
  modalidad?: string | null;
  rei?: string | null;
  plaza_id?: string | null;
};

export type DirectorPlazaInfo = {
  id: string;
  codigoInstitucional: string;
  institucionNombre: string;
  modalidad: string;
  rei: string;
  alias: string;
  estado: "VACANTE" | "OCUPADA" | "INACTIVA";
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const candidate = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof candidate.text === "string") return candidate.text;
    if (candidate.result != null) return String(candidate.result);
    if (Array.isArray(candidate.richText)) return candidate.richText.map((part) => part.text ?? "").join("");
  }
  return String(value);
}

function nullable(value: unknown) {
  const text = cellText(value).trim();
  return text || null;
}

export function normalizeUpperText(value: unknown) {
  return cellText(value).trim().toLocaleUpperCase("es");
}

export function normalizeRei(value: unknown): string | null {
  const text = normalizeUpperText(value).replace(/\s+/g, " ");
  if (!text || text === "SIN REI") return "SIN REI";
  if (!/^(?:REI )?(?:0?[1-9]|1[0-9])$/.test(text)) return null;
  return text.replace(/\D/g, "").padStart(2, "0");
}

export function normalizeInstitutionalCode(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99_999_999) {
    return String(value).padStart(8, "0");
  }
  return cellText(value).trim();
}

export function normalizeModalidad(value: unknown): string {
  return normalizeUpperText(value).replace(/\s+/g, " ");
}

export function directorPlazaKey(codigoInstitucional: unknown, modalidad: unknown) {
  return `${normalizeInstitutionalCode(codigoInstitucional)}|${normalizeModalidad(modalidad)}`;
}

export function isPublicManagement(value: unknown) {
  return normalizeUpperText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").includes("PUBLIC");
}

function nullableUpper(value: unknown) {
  const text = normalizeUpperText(value);
  return text || null;
}

export function isStrongPassword(password: string) {
  return password.length >= 8
    && /\p{Lu}/u.test(password)
    && /\p{Ll}/u.test(password)
    && /\p{N}/u.test(password)
    && /[^\p{L}\p{N}]/u.test(password);
}

export function generateTemporaryPassword(apellidoPaterno: string) {
  const base = apellidoPaterno
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLocaleLowerCase("es");
      return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
    })
    .join("");
  return base ? `${base}123@@` : "";
}

function parseBoolean(value: unknown) {
  const normalized = cellText(value).trim().toLocaleUpperCase("es");
  if (["SI", "SÍ", "TRUE", "1", "X"].includes(normalized)) return true;
  if (["", "NO", "FALSE", "0"].includes(normalized)) return false;
  return null;
}

function parseDate(value: unknown) {
  if (value == null || cellText(value).trim() === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = cellText(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
}

function normalizedSchoolTokens(value: unknown) {
  const ignored = new Set(["I", "IE", "N", "NO", "NRO", "INSTITUCION", "EDUCATIVA", "PUBLICA"]);
  return new Set(normalizeUpperText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !ignored.has(token)));
}

export function schoolNamesAreSimilar(reference: unknown, official: unknown) {
  const left = normalizedSchoolTokens(reference);
  const right = normalizedSchoolTokens(official);
  if (!left.size || !right.size) return true;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(left.size, right.size) >= 0.5;
}

export function validateUserImportRows(
  rows: Array<{ sourceRow: number; values: Record<string, unknown> }>,
  activeRoleCodes: Set<string>,
  existingEmails = new Set<string>(),
  existingDocuments = new Set<string>(),
  directorPlazas?: Map<string, DirectorPlazaInfo>
): UserImportPreviewRow[] {
  const prepared: UserImportPreviewRow[] = rows.map(({ sourceRow, values }) => {
    const tipo = cellText(values.tipo_documento).trim().toUpperCase();
    const inputEmail = cellText(values.correo).trim().toLowerCase();
    const documento = cellText(values.numero_documento).trim();
    const rol = cellText(values.rol).trim().toLowerCase();
    const fecha = parseDate(values.fecha_nacimiento);
    const monitorFlag = parseBoolean(values.can_create_monitoreo);
    const inputRei = normalizeRei(values.rei);
    const institutionalCode = normalizeInstitutionalCode(values.codigo_institucional);
    const modalidad = normalizeModalidad(values.modalidad);
    const plaza = directorPlazas?.get(directorPlazaKey(institutionalCode, modalidad));
    const correo = rol === "director_iiee" && plaza ? plaza.alias : inputEmail;
    const rei = rol === "director_iiee" && plaza ? plaza.rei : inputRei;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (tipo !== "DNI" && tipo !== "CE") errors.push("Tipo de documento inválido");
    if (!documento) errors.push("Documento obligatorio");
    const apellidoPaterno = normalizeUpperText(values.apellido_paterno);
    const temporaryPassword = generateTemporaryPassword(apellidoPaterno);
    if (!apellidoPaterno) errors.push("Apellido paterno obligatorio");
    if (!cellText(values.apellido_materno).trim()) errors.push("Apellido materno obligatorio");
    if (!cellText(values.nombres).trim()) errors.push("Nombres obligatorios");
    if (!correo.endsWith("@ugel06.gob.pe") || correo.startsWith("@")) errors.push("Correo institucional inválido");
    if (!activeRoleCodes.has(rol)) errors.push("Rol inexistente o inactivo");
    if (fecha === undefined) errors.push("Fecha inválida; usa AAAA-MM-DD");
    if (rol !== "director_iiee" && monitorFlag === null) errors.push("can_create_monitoreo debe ser SI o NO");
    if (rei === null) errors.push("REI inválida; usa 01 a 19 o SIN REI");
    if (rol === "director_iiee") {
      if (!institutionalCode) errors.push("Código institucional obligatorio para Director IIEE");
      else if (!/^\d{8}$/.test(institutionalCode)) errors.push("Código institucional debe tener exactamente 8 dígitos");
      if (!modalidad) errors.push("Modalidad obligatoria para Director IIEE");
      if (!cellText(values.nombre_colegio_referencia).trim()) errors.push("Nombre del colegio obligatorio como referencia");
      if (directorPlazas && !plaza) errors.push("No existe una plaza para el código institucional y modalidad");
      if (plaza?.estado === "OCUPADA") errors.push("La plaza ya está ocupada");
      if (plaza?.estado === "INACTIVA") errors.push("La plaza está inactiva");
      if (plaza && !schoolNamesAreSimilar(values.nombre_colegio_referencia, plaza.institucionNombre)) {
        warnings.push("El nombre escrito difiere del colegio oficial; verifica el código institucional");
      }
      if (plaza && inputEmail && inputEmail !== plaza.alias) warnings.push("El correo escrito fue reemplazado por el alias de la plaza");
      if (plaza && inputRei && inputRei !== plaza.rei) warnings.push("La REI escrita fue reemplazada por la REI oficial de la plaza");
      if (monitorFlag === true) warnings.push("Director IIEE no puede crear monitoreos; se aplicará NO");
    } else if (institutionalCode || modalidad || cellText(values.nombre_colegio_referencia).trim()) {
      errors.push("Los datos de plaza solo corresponden al rol Director IIEE");
    }
    if (temporaryPassword && !isStrongPassword(temporaryPassword)) errors.push("No se pudo generar una contraseña temporal segura");

    return {
      source_row: sourceRow,
      tipo_documento: tipo === "CE" ? "CE" : "DNI",
      numero_documento: documento,
      apellido_paterno: apellidoPaterno,
      apellido_materno: normalizeUpperText(values.apellido_materno),
      nombres: normalizeUpperText(values.nombres),
      correo,
      telefono: nullable(values.telefono),
      fecha_nacimiento: fecha ?? null,
      cargo: nullableUpper(values.cargo),
      area: nullableUpper(values.area),
      comision: nullableUpper(values.comision),
      ugel: nullableUpper(values.ugel) ?? "UGEL 06",
      rei: rei ?? "SIN REI",
      codigo_institucional: institutionalCode || null,
      nombre_colegio_referencia: nullableUpper(values.nombre_colegio_referencia),
      modalidad: modalidad || null,
      plaza_id: plaza?.id ?? null,
      rol,
      can_create_monitoreo: rol === "director_iiee" ? false : monitorFlag ?? false,
      institucion_nombre: plaza?.institucionNombre ?? null,
      errors,
      warnings,
      status: errors.length ? "invalid" : "valid",
    };
  });

  const emailCounts = new Map<string, number>();
  const documentCounts = new Map<string, number>();
  for (const row of prepared) {
    if (row.correo) emailCounts.set(row.correo, (emailCounts.get(row.correo) ?? 0) + 1);
    if (row.numero_documento) documentCounts.set(row.numero_documento, (documentCounts.get(row.numero_documento) ?? 0) + 1);
  }

  return prepared.map((row) => {
    const errors = [...row.errors];
    if ((emailCounts.get(row.correo) ?? 0) > 1) errors.push("Correo duplicado en el archivo");
    if ((documentCounts.get(row.numero_documento) ?? 0) > 1) errors.push("Documento duplicado en el archivo");
    if (existingEmails.has(row.correo)) errors.push("Correo ya registrado");
    if (existingDocuments.has(row.numero_documento)) errors.push("Documento ya registrado");
    return { ...row, errors, status: errors.length ? "invalid" as const : "valid" as const };
  });
}

export async function readUserImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Selecciona un archivo .xlsx basado en la plantilla.");
  if (file.size > 5 * 1024 * 1024) throw new Error("El archivo supera el máximo permitido de 5 MB.");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("Usuarios");
  if (!sheet) throw new Error("No se encontró la hoja Usuarios.");
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => cellText(value).trim());
  const missing = USER_IMPORT_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}.`);
  const columnByHeader = new Map(headers.map((header, index) => [header, index + 1]));
  const rows: Array<{ sourceRow: number; values: Record<string, unknown> }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    for (const header of USER_IMPORT_HEADERS) values[header] = row.getCell(columnByHeader.get(header) ?? 0).value;
    if (USER_IMPORT_HEADERS.some((header) => cellText(values[header]).trim() !== "")) rows.push({ sourceRow: rowNumber, values });
  });
  if (!rows.length) throw new Error("La plantilla no contiene usuarios.");
  if (rows.length > 300) throw new Error("La carga admite como máximo 300 usuarios por archivo.");
  return rows;
}

export async function downloadUserImportResults(rows: UserImportResultRow[], fileName: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Resumen");
  sheet.columns = [
    { header: "fila", key: "source_row", width: 10 }, { header: "estado", key: "status", width: 14 },
    { header: "correo", key: "correo", width: 34 }, { header: "documento", key: "numero_documento", width: 20 },
    { header: "nombres", key: "nombres", width: 32 }, { header: "contraseña_temporal", key: "temporary_password", width: 24 },
    { header: "codigo_institucional", key: "codigo_institucional", width: 22 },
    { header: "institucion", key: "institucion_nombre", width: 38 },
    { header: "modalidad", key: "modalidad", width: 16 },
    { header: "rei", key: "rei", width: 12 },
    { header: "detalle", key: "message", width: 55 },
  ];
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2747" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "K1" };
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const status = sheet.getCell(index, 2).value;
    sheet.getCell(index, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: status === "created" ? "FFD1FAE5" : status === "skipped" ? "FFFEF3C7" : "FFFEE2E2" } };
  }
  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}
