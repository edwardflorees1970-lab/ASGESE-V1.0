export type AnalyticsCell = string | number | boolean | Date | null;

export type AnalyticsColumn = {
  key: string;
  header: string;
  width?: number;
  kind?: "text" | "number" | "boolean" | "date" | "datetime";
};

export type AnalyticsRow = Record<string, AnalyticsCell>;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvValue(value: AnalyticsCell, kind?: AnalyticsColumn["kind"]) {
  if (value == null) return "";
  if (value instanceof Date) {
    if (kind === "date") return value.toISOString().slice(0, 10);
    return value.toISOString();
  }
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

export function exportAnalyticsCsv(
  filename: string,
  columns: AnalyticsColumn[],
  rows: AnalyticsRow[]
) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    columns.map((column) => escape(column.header)).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => escape(csvValue(row[column.key] ?? null, column.kind)))
        .join(",")
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(filename, blob);
}

export async function exportAnalyticsExcel(
  filename: string,
  sheetName: string,
  columns: AnalyticsColumn[],
  rows: AnalyticsRow[]
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Monitoreo AGEBERE - UGEL 06";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 18,
  }));

  rows.forEach((row) => {
    worksheet.addRow(
      columns.reduce<Record<string, AnalyticsCell>>((result, column) => {
        result[column.key] = row[column.key] ?? null;
        return result;
      }, {})
    );
  });

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17324D" },
  };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 24;

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);
    if (column.kind === "date") excelColumn.numFmt = "yyyy-mm-dd";
    if (column.kind === "datetime") excelColumn.numFmt = "yyyy-mm-dd hh:mm:ss";
    if (column.kind === "number") excelColumn.numFmt = "0.########";

    let maxLength = column.header.length;
    const sampleLimit = Math.min(rows.length, 5000);
    for (let rowIndex = 0; rowIndex < sampleLimit; rowIndex += 1) {
      const value = rows[rowIndex]?.[column.key];
      const display =
        value instanceof Date
          ? column.kind === "date"
            ? "yyyy-mm-dd"
            : "yyyy-mm-dd hh:mm:ss"
          : String(value ?? "");
      maxLength = Math.max(maxLength, Math.min(display.length, 60));
    }
    excelColumn.width = Math.max(column.width ?? 12, Math.min(maxLength + 2, 60));
  });

  if (columns.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, rows.length + 1), column: columns.length },
    };
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: false };
    if (rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F6FA" },
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
}
