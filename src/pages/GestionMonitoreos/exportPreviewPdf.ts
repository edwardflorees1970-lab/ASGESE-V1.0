import jsPDF from "jspdf";
import logoUrl from "../../assets/logoagebresf.png";
import type { HeaderFieldDef } from "../../lib/dynamicHeader";
import { DEFAULT_NIVEL_INFO } from "./constants";
import { loadImage, normalizeExtraFields, toDataUrl } from "./helpers";
import type { Question, Section, Template } from "./types";

export async function exportPreviewPdf(params: {
  selectedTemplate: Template | null;
  templateHeader: any;
  templateFooter: any;
  previewData: Record<string, any>;
  sections: Section[];
  questions: Question[];
}) {
  const { selectedTemplate, templateHeader, templateFooter, previewData, sections, questions } = params;
  if (!selectedTemplate) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 18;
  const contentW = pageW - M * 2;
  const lineH = 5;
  const smallLineH = 4.2;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 14) {
      doc.addPage();
      y = 18;
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(10);
    doc.setFillColor(230, 236, 243);
    doc.setDrawColor(160, 170, 185);
    doc.rect(M, y - 2.5, contentW, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, M + 2, y + 2.5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const drawKeyValueGrid = (pairs: Array<[string, string]>) => {
    if (!pairs.length) return;
    const cols = 2;
    const colW = contentW / cols;
    const rowH = 8;
    const rows = Math.ceil(pairs.length / cols);
    ensureSpace(rows * rowH + 4);
    doc.setDrawColor(200);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const idx = r * cols + c;
        const x = M + c * colW;
        const yCell = y + r * rowH;
        doc.rect(x, yCell, colW, rowH);
        const pair = pairs[idx];
        if (pair) {
          doc.setFontSize(8);
          doc.setTextColor(90);
          doc.text(pair[0], x + 2, yCell + 3.5);
          doc.setFontSize(9);
          doc.setTextColor(20);
          const valueLines = doc.splitTextToSize(pair[1] || "-", colW - 4);
          doc.text(valueLines, x + 2, yCell + 7);
        }
      }
    }
    doc.setTextColor(20);
    y += rows * rowH + 4;
    doc.setFontSize(10);
  };

  // Logo
  try {
    const img = await loadImage(logoUrl);
    const imgW = 22;
    const imgH = (img.height / img.width) * imgW;
    const dataUrl = toDataUrl(img);
    if (dataUrl) doc.addImage(dataUrl, "PNG", M, y - 8, imgW, imgH);
  } catch {
    // no-op
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(selectedTemplate.titulo, M + 26, y);
  y += 6;

  if (selectedTemplate.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(selectedTemplate.subtitulo, M + 26, y);
    y += 6;
  }

  doc.setDrawColor(220);
  doc.line(M, y, pageW - M, y);
  y += 10;

  const header = previewData.__header ?? {};
  const footer = previewData.__footer ?? {};
  const headerPairs: Array<[string, string]> = [];
  if (templateHeader.institucion) headerPairs.push(["Institución educativa", header.institucion ?? ""]);
  if (templateHeader.codigo_modular) headerPairs.push(["Código modular", header.codigo_modular ?? ""]);
  if (templateHeader.codigo_local) headerPairs.push(["Código local", header.codigo_local ?? ""]);
  if (templateHeader.distrito) headerPairs.push(["Distrito / Lugar", header.distrito ?? ""]);
  if (templateHeader.rei) headerPairs.push(["REI", header.rei ?? ""]);
  if (templateHeader.monitor) headerPairs.push(["Monitor", header.monitor ?? ""]);
  if (templateHeader.monitor_doc_tipo) headerPairs.push(["Tipo doc. monitor", header.monitor_doc_tipo ?? ""]);
  if (templateHeader.monitor_numero_doc)
    headerPairs.push(["Numero doc. monitor", header.monitor_numero_doc ?? ""]);
  if (templateHeader.monitoreado) headerPairs.push(["Monitoreado", header.monitoreado ?? ""]);
  if (templateHeader.monitoreado_doc_tipo)
    headerPairs.push(["Tipo doc. monitoreado", header.monitoreado_doc_tipo ?? ""]);
  if (templateHeader.monitoreado_numero_doc)
    headerPairs.push(["Numero doc. monitoreado", header.monitoreado_numero_doc ?? ""]);
  if (templateHeader.monitoreado_cargo) headerPairs.push(["Cargo monitoreado", header.monitoreado_cargo ?? ""]);
  if (templateHeader.monitoreado_telefono)
    headerPairs.push(["Telefono monitoreado", header.monitoreado_telefono ?? ""]);
  if (templateHeader.monitoreado_correo)
    headerPairs.push(["Correo monitoreado", header.monitoreado_correo ?? ""]);
  if (templateHeader.condicion) headerPairs.push(["Condición de monitoreado", header.condicion ?? ""]);
  if (templateHeader.area) headerPairs.push(["Área", header.area ?? ""]);
  if (templateHeader.numero_visitas)
    headerPairs.push(["Numero de visitas a la IE", header.numero_visitas ?? ""]);
  if (templateHeader.fecha_aplicacion)
    headerPairs.push(["Fecha de aplicacion", header.fecha_aplicacion ?? ""]);
  if (templateHeader.hora_inicio) headerPairs.push(["Hora de inicio", header.hora_inicio ?? ""]);
  if (templateHeader.hora_fin) headerPairs.push(["Hora de fin", header.hora_fin ?? ""]);
  (templateHeader.custom_fields ?? []).forEach((field: HeaderFieldDef) => {
    headerPairs.push([field.label, header.custom_values?.[field.key] ?? ""]);
  });

  if (headerPairs.length) {
    drawSectionHeader("Encabezado");
    drawKeyValueGrid(headerPairs);
  }

  if (templateHeader.nivel_avance) {
    const source = (templateHeader.nivel_avance_info ?? []).length
      ? templateHeader.nivel_avance_info
      : DEFAULT_NIVEL_INFO;
    const nivelPairs: Array<[string, string]> = source.map((x: any) => [
      `Nivel ${x.nivel}`,
      x.descripcion ?? "",
    ]);
    drawSectionHeader("Niveles de respuesta (Sí)");
    drawKeyValueGrid(nivelPairs);
  }

  sections.forEach((s) => {
    drawSectionHeader(s.titulo);

    questions.filter((q) => q.section_id === s.id).forEach((q) => {
      const title = `${q.orden_in_section ?? q.orden}. ${q.texto}`;
      const lines = doc.splitTextToSize(title, contentW);
      ensureSpace(lines.length * lineH + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(lines, M, y);
      y += lines.length * lineH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const p = previewData[q.id] ?? {};
      const parts: string[] = [];
      if (q.tipo === "yes_no") parts.push(`Respuesta: ${p.yn ?? "-"}`);
      if (q.tipo === "yes_no_nivel") {
        const levelLabels = q.config_json?.levelLabels ?? [];
        const nivelLabel = p.nivel
          ? levelLabels.find((l: any) => l.value === p.nivel)?.label ?? p.nivel
          : "-";
        parts.push(`Respuesta: ${p.yn ?? "-"}`);
        parts.push(`Nivel: ${nivelLabel}`);
      }
      if (q.tipo === "opciones") {
        if (p.option) parts.push(`Opción: ${p.option}`);
        if (p.options?.length) parts.push(`Opciones: ${p.options.join(", ")}`);
        if (!p.option && !p.options?.length) parts.push("Opciones: -");
      }
      if (q.tipo === "texto") parts.push(`Respuesta: ${p.text ?? "-"}`);
      if (q.tipo === "numero") parts.push(`Respuesta: ${p.number ?? "-"}`);
      if (q.tipo === "archivo_pdf") parts.push(`Archivo: ${p.fileName ?? "-"}`);
      if (q.config_json?.include_obs !== false) parts.push(`Observación: ${p.obs ?? "-"}`);
      const extraFields = normalizeExtraFields(q.config_json?.extra_fields);
      extraFields.forEach((f) => {
        const val = f.mode === "elaboracion" ? f.default_value ?? "" : p?.extra?.[f.label] ?? "-";
        parts.push(`${f.label}: ${val || "-"}`);
      });

      if (parts.length) {
        const detail = parts.join(" | ");
        const detailLines = doc.splitTextToSize(detail, contentW);
        doc.text(detailLines, M, y);
        y += detailLines.length * smallLineH;
      }

      y += 4;
      doc.setDrawColor(235);
      doc.line(M, y, pageW - M, y);
      y += 3;
    });
  });

  const footerPairs: Array<[string, string]> = [];
  if (templateFooter.observacion) footerPairs.push(["Observación general", footer.observacion ?? ""]);
  if (templateFooter.compromiso) footerPairs.push(["Compromiso", footer.compromiso ?? ""]);
  if (templateFooter.lugar) footerPairs.push(["Lugar", footer.lugar ?? ""]);
  if (templateFooter.fecha) footerPairs.push(["Fecha", footer.fecha ?? ""]);
  if (templateFooter.docente_nombre) footerPairs.push(["Monitoreado", footer.docente_nombre ?? ""]);
  if (templateFooter.docente_dni) footerPairs.push(["DNI Monitoreado", footer.docente_dni ?? ""]);
  if (templateFooter.monitor_nombre) footerPairs.push(["Monitor", footer.monitor_nombre ?? ""]);
  if (templateFooter.monitor_dni) footerPairs.push(["DNI Monitor", footer.monitor_dni ?? ""]);

  if (footerPairs.length) {
    drawSectionHeader("Cierre");
    drawKeyValueGrid(footerPairs);
  }

  if (y + 22 > pageH - 14) {
    doc.addPage();
    y = 18;
  }
  doc.setDrawColor(120);
  doc.line(M, y + 12, M + 70, y + 12);
  doc.line(pageW - M - 70, y + 12, pageW - M, y + 12);
  doc.setFontSize(8);
  doc.text("Firma docente monitoreado", M, y + 16);
  doc.text("Firma monitor", pageW - M - 70, y + 16);

  doc.save(`preview_${selectedTemplate.codigo || "ficha"}.pdf`);
}
