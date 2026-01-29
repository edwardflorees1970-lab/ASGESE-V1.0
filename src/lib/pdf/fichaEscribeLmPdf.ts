import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Tipos (mínimos) para no acoplar todo tu front aquí
export type NivelAvance = 1 | 2 | 3;

export type HeaderState = {
  institucion_educativa: string;
  codigo_modular: string;
  codigo_local: string;
  lugar_ie: string;
  director_monitor: string;
  docente: string;
  condicion_docente: "NOMBRADO" | "CONTRATADO" | "";
  area_monitoreo: "COMUNICACION" | "QUECHUA" | "INGLES" | "";
};

export type QuestionState = {
  yn: "SI" | "NO" | "";
  nivel: NivelAvance | null;
  obs: string;
};

export type FooterState = {
  observacion_general: string;
  compromiso: string;
  lugar: string;
  fecha: string; // yyyy-mm-dd
  docente_firma_nombre: string;
  docente_firma_dni: string;
  monitor_firma_nombre: string;
  monitor_firma_dni: string;
  docente_doc_tipo?: "DNI" | "CE";
  monitor_doc_tipo?: "DNI" | "CE";
};

export type QuestionItem = {
  id: string;
  numero: string;
  texto: string;
  group: string; // PLANIFICACION / TEXTUALIZACION / REVISION / EVALUACION
};

function fmtNowPE() {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function safe(s: any) {
  return String(s ?? "").trim();
}

export function exportFichaEscribeLmPdf(args: {
  titulo: string;
  area: string;
  header: HeaderState;
  preguntas: QuestionItem[];
  answers: Record<string, QuestionState>;
  footer: FooterState;

  // opcional: si luego quieres logo UGEL en base64
  logoDataUrl?: string; // "data:image/png;base64,..."
}) {
  const { titulo, area, header, preguntas, answers, footer, logoDataUrl } = args;

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // Márgenes
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const pageRight = W - M;
  const headerX = logoDataUrl ? M + 22 : M;

  // ===== Encabezado "oficial"
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", M, 8, 18, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("UGEL 06", headerX, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("FICHA DE MONITOREO", headerX, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(titulo, headerX, 28, { maxWidth: W - M * 2 - (logoDataUrl ? 22 : 0) });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Área: ${area}`, headerX, 40);

  doc.setFontSize(8);
  doc.text(`Generado: ${fmtNowPE()}`, pageRight, 12, { align: "right" });

  // ===== Tabla de datos del encabezado
  autoTable(doc, {
    startY: 44,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    body: [
      ["Institución Educativa", safe(header.institucion_educativa), "Código Modular", safe(header.codigo_modular)],
      ["Código Local", safe(header.codigo_local), "Lugar IE", safe(header.lugar_ie)],
      ["Director(a) / Monitor(a)", safe(header.director_monitor), "Docente", safe(header.docente)],
      [
        "Condición Docente",
        safe(header.condicion_docente),
        "Área monitoreada",
        safe(header.area_monitoreo),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 65 },
      2: { cellWidth: 30 },
      3: { cellWidth: 45 },
    },
  });

  // ===== Nivel de avance
  const yAfterHead = (doc as any).lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Nivel de avance", M, yAfterHead);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("1: Incipiente | 2: Parcial | 3: Logrado", M, yAfterHead + 4);

  // ===== Tabla de preguntas
  const rows = preguntas.map((q) => {
    const st = answers[q.id] ?? { yn: "", nivel: null, obs: "" };
    const si = st.yn === "SI" ? "X" : "";
    const no = st.yn === "NO" ? "X" : "";
    const n1 = st.yn === "SI" && st.nivel === 1 ? "X" : "";
    const n2 = st.yn === "SI" && st.nivel === 2 ? "X" : "";
    const n3 = st.yn === "SI" && st.nivel === 3 ? "X" : "";
    return [
      q.numero,
      q.group,
      q.texto,
      si,
      no,
      n1,
      n2,
      n3,
      safe(st.obs),
    ];
  });

  autoTable(doc, {
    startY: yAfterHead + 8,
    theme: "grid",
    styles: { fontSize: 7.2, cellPadding: 1.6, valign: "top" },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    head: [
      ["Ítem", "Sección", "Pregunta", "Sí", "No", "1", "2", "3", "Observación"],
    ],
    body: rows,
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 78 },
      3: { cellWidth: 7, halign: "center" },
      4: { cellWidth: 7, halign: "center" },
      5: { cellWidth: 7, halign: "center" },
      6: { cellWidth: 7, halign: "center" },
      7: { cellWidth: 7, halign: "center" },
      8: { cellWidth: 45 },
    },
    didDrawPage: (data) => {
      // Footer por página
      const pageCount = doc.getNumberOfPages();
      const pageNo = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Página ${pageNo} / ${pageCount}`, pageRight, 290, { align: "right" });
      doc.setTextColor(0);
    },
    margin: { left: M, right: M },
  });

  // ===== Cierre / Observación general / Compromiso
  const yAfterQ = (doc as any).lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: yAfterQ,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    head: [["Cierre"]],
    body: [
      ["Observación general", safe(footer.observacion_general)],
      ["Compromiso", safe(footer.compromiso)],
      ["Lugar y fecha", `${safe(footer.lugar)} - ${safe(footer.fecha)}`],
    ],
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: W - M * 2 - 35 },
    },
    margin: { left: M, right: M },
  });

  // ===== Firmas
  const yAfterClose = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Líneas
  doc.line(M, yAfterClose + 18, M + 80, yAfterClose + 18);
  doc.line(M + 105, yAfterClose + 18, pageRight, yAfterClose + 18);

  doc.setFontSize(8);
  doc.text("Firma docente monitoreado", M, yAfterClose + 6);
  doc.text("Firma monitor", M + 105, yAfterClose + 6);

  doc.setFontSize(8);
  doc.text(safe(footer.docente_firma_nombre), M, yAfterClose + 22);
  doc.text(`DNI: ${safe(footer.docente_firma_dni)}`, M, yAfterClose + 26);

  doc.text(safe(footer.monitor_firma_nombre), M + 105, yAfterClose + 22);
  doc.text(`DNI: ${safe(footer.monitor_firma_dni)}`, M + 105, yAfterClose + 26);

  // Nombre del archivo
  const fname = `UGEL06_Ficha_LM_ESCRIBE_${safe(header.codigo_modular) || "SINCM"}_${safe(footer.fecha) || ""}.pdf`;
  doc.save(fname);
}
