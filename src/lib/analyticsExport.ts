import type { Cell as ExcelCell, Feature } from "write-excel-file/browser";

export type AnalyticsCell = string | number | boolean | Date | null;

export type AnalyticsColumn = {
  key: string;
  header: string;
  width?: number;
  kind?: "text" | "number" | "integer" | "percentage" | "boolean" | "date" | "datetime";
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
  const [{ default: writeExcelFile }, excelUtility] = await Promise.all([
    import("write-excel-file/browser"),
    import("write-excel-file/utility"),
  ]);

  const formatByKind: Partial<Record<NonNullable<AnalyticsColumn["kind"]>, string>> = {
    text: "@",
    number: "0.########",
    integer: "0",
    percentage: "0.00%",
    date: "yyyy-mm-dd",
    datetime: "yyyy-mm-dd hh:mm:ss",
  };

  const excelRows: ExcelCell[][] = [
    columns.map((column) => ({
      value: column.header,
      type: String,
      fontWeight: "bold",
      textColor: "#FFFFFF",
      backgroundColor: "#17324D",
      align: "center",
      alignVertical: "center",
      height: 24,
    })),
    ...rows.map((row, rowIndex) =>
      columns.map((column): ExcelCell => {
        const value = row[column.key] ?? null;
        if (value === null) return null;

        return {
          value,
          type:
            value instanceof Date
              ? Date
              : typeof value === "number"
                ? Number
                : typeof value === "boolean"
                  ? Boolean
                  : String,
          format: formatByKind[column.kind ?? "text"],
          alignVertical: "top",
          wrap: false,
          ...(rowIndex % 2 === 0 ? { backgroundColor: "#F2F6FA" } : {}),
        };
      })
    ),
  ];

  const excelColumns = columns.map((column) => {
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
    return { width: Math.max(column.width ?? 12, Math.min(maxLength + 2, 60)) };
  });

  const features: Feature<File | Blob | ArrayBuffer>[] = [];
  if (columns.length > 0) {
    const lastCell = excelUtility.getCellAddress(rows.length, columns.length - 1);
    features.push({
      files: {
        transform: {
          "xl/worksheets/sheet{id}.xml": {
            transform(xml) {
              const order = excelUtility.getOrderOfSiblings(
                "xl/worksheets/sheet{id}.xml",
                "worksheet"
              );
              if (!order) return xml;
              return excelUtility.insertElementMarkupAccordingToOrderOfSiblings(
                xml,
                `<autoFilter ref="A1:${lastCell}"/>`,
                order,
                "worksheet"
              );
            },
          },
        },
      },
    });
  }

  const blob = await writeExcelFile(
    excelRows,
    {
      sheet: sheetName.slice(0, 31),
      columns: excelColumns,
      stickyRowsCount: 1,
    },
    { features }
  ).toBlob();

  downloadBlob(filename, blob);
}
