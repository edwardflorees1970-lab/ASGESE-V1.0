function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function downloadCanvas(canvas: HTMLCanvasElement, title: string) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo generar la imagen PNG."));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFilename(title) || "reporte"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, "image/png", 0.96);
  });
}

export async function exportReportElementAsPng(container: HTMLElement, title: string) {
  const { default: html2canvas } = await import("html2canvas");
  container.classList.add("report-export-capture");
  const expandable = Array.from(container.querySelectorAll<HTMLElement>("[data-export-expand='true']"));
  const previousStyles = expandable.map((element) => ({ element, maxHeight: element.style.maxHeight, overflow: element.style.overflow }));
  expandable.forEach((element) => { element.style.maxHeight = "none"; element.style.overflow = "visible"; });
  const width = Math.max(320, Math.ceil(container.scrollWidth));
  const height = Math.max(160, Math.ceil(container.scrollHeight) + 64);
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#182431",
      logging: false,
      scale,
      useCORS: true,
      width,
      height,
      windowWidth: Math.max(width, 1024),
      windowHeight: height,
      ignoreElements: (element) => element instanceof HTMLElement && element.dataset.exportIgnore === "true",
      onclone: (documentClone) => {
        documentClone.querySelectorAll<HTMLElement>("[data-export-only='true']").forEach((element) => {
          element.style.display = "block";
        });
      },
    });
    await downloadCanvas(canvas, title);
  } finally {
    container.classList.remove("report-export-capture");
    previousStyles.forEach(({ element, maxHeight, overflow }) => { element.style.maxHeight = maxHeight; element.style.overflow = overflow; });
  }
}

export const exportChartElementAsPng = exportReportElementAsPng;
