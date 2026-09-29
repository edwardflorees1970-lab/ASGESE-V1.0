import { PreviewFicha } from "./PreviewFicha";
import type { Question, Section, Template } from "./types";

/**
 * Vista previa a pantalla completa. Solo aporta el marco del modal: el
 * contenido de la ficha vive en PreviewFicha, que también se usa en el panel
 * lateral en vivo del constructor.
 */
export function PreviewModal({
  open,
  onClose,
  selectedTemplate,
  templateHeader,
  templateFooter,
  previewData,
  savePreview,
  sections,
  questions,
  onExportPdf,
}: {
  open: boolean;
  onClose: () => void;
  selectedTemplate: Template | null;
  templateHeader: any;
  templateFooter: any;
  previewData: Record<string, any>;
  savePreview: (next: Record<string, any>) => void;
  sections: Section[];
  questions: Question[];
  onExportPdf: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-start justify-center p-4 md:items-center">
        <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="text-sm font-semibold">Vista previa de ficha</div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/5"
            >
              Cerrar
            </button>
          </div>
          <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-5">
            <PreviewFicha
              variant="modal"
              selectedTemplate={selectedTemplate}
              templateHeader={templateHeader}
              templateFooter={templateFooter}
              previewData={previewData}
              savePreview={savePreview}
              sections={sections}
              questions={questions}
              onExportPdf={onExportPdf}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
