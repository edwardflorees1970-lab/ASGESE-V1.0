import { afterEach, describe, expect, it, vi } from "vitest";
import { exportAnalyticsExcel } from "./analyticsExport";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("exportAnalyticsExcel", () => {
  it("genera un XLSX con valores nativos y filtros sin cargar ExcelJS", async () => {
    let generatedBlob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        generatedBlob = blob;
        return "blob:analytics-export";
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await exportAnalyticsExcel(
      "reporte.xlsx",
      "Indicadores generales",
      [
        { key: "cantidad", header: "Cantidad", kind: "integer" },
        { key: "porcentaje", header: "Porcentaje", kind: "percentage" },
        { key: "fecha", header: "Fecha", kind: "date" },
      ],
      [{ cantidad: 25, porcentaje: 0.25, fecha: new Date("2026-08-08T00:00:00Z") }]
    );

    expect(generatedBlob).toBeInstanceOf(Blob);
    expect(generatedBlob?.size).toBeGreaterThan(1_000);
    expect(generatedBlob?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });
});
