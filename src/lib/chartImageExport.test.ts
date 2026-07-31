import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { html2canvasMock, captureState } = vi.hoisted(() => {
  const state = { compatibleModeObserved: false };
  return {
    captureState: state,
    html2canvasMock: vi.fn(async (container: HTMLElement) => {
      state.compatibleModeObserved = container.classList.contains("report-export-capture");
      return {
        toBlob(callback: (blob: Blob | null) => void) {
          callback(new Blob(["png"], { type: "image/png" }));
        },
      } as HTMLCanvasElement;
    }),
  };
});

vi.mock("html2canvas", () => ({ default: html2canvasMock }));

import { exportReportElementAsPng } from "./chartImageExport";

describe("exportReportElementAsPng", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    html2canvasMock.mockClear();
    captureState.compatibleModeObserved = false;
    URL.createObjectURL = vi.fn(() => "blob:report-test");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it("descarga el bloque completo y restaura sus estilos", async () => {
    const container = document.createElement("div");
    const scrollable = document.createElement("div");
    scrollable.dataset.exportExpand = "true";
    scrollable.style.maxHeight = "240px";
    scrollable.style.overflow = "auto";
    container.appendChild(scrollable);
    document.body.appendChild(container);

    await exportReportElementAsPng(container, "Matriz por REI");

    expect(html2canvasMock).toHaveBeenCalledOnce();
    expect(captureState.compatibleModeObserved).toBe(true);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(container.classList.contains("report-export-capture")).toBe(false);
    expect(scrollable.style.maxHeight).toBe("240px");
    expect(scrollable.style.overflow).toBe("auto");
    container.remove();
  });
});
