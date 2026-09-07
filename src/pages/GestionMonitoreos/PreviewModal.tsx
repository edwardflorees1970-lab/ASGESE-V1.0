import type { HeaderFieldDef } from "../../lib/dynamicHeader";
import { DEFAULT_NIVEL_INFO } from "./constants";
import { normalizeExtraFields, groupMatrixCols, computeMatrixAutoTotals, sectionRomanNumeral, buildTablaMatrizFlags } from "./helpers";
import { TimeField } from "./TimeField";
import type { Question, Section, Template } from "./types";

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
  const tablaMatrizFlags = buildTablaMatrizFlags(sections, questions);
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
            <div className="space-y-4">
              {selectedTemplate && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-lg font-semibold">{selectedTemplate.titulo}</div>
                  {selectedTemplate.subtitulo && (
                    <div className="text-sm text-white/60">{selectedTemplate.subtitulo}</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => savePreview({ ...previewData })}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                    >
                      Guardar borrador
                    </button>
                    <button
                      type="button"
                      onClick={() => savePreview({ ...previewData })}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
                    >
                      Guardar en BD
                    </button>
                    <button
                      type="button"
                      onClick={onExportPdf}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                    >
                      Exportar PDF
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-white/50">
                    Vista previa: el guardado es local para pruebas.
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold">Encabezado</div>
                <div className="mt-2 grid gap-3 md:grid-cols-2 text-xs text-white/70">
                  {templateHeader.institucion && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Institución educativa</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.institucion ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, institucion: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.codigo_modular && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Código modular</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.codigo_modular ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, codigo_modular: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.codigo_local && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Código local</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.codigo_local ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, codigo_local: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.distrito && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Distrito / lugar</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.distrito ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, distrito: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.rei && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">REI</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.rei ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, rei: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitor && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Monitor</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitor ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitor: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitor_doc_tipo && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Tipo doc. monitor</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitor_doc_tipo ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitor_doc_tipo: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitor_numero_doc && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Numero doc. monitor</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitor_numero_doc ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitor_numero_doc: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitoreado && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitoreado ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitoreado: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitoreado_doc_tipo && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Tipo doc. monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitoreado_doc_tipo ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitoreado_doc_tipo: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitoreado_numero_doc && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Numero doc. monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitoreado_numero_doc ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitoreado_numero_doc: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitoreado_cargo && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Cargo monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitoreado_cargo ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitoreado_cargo: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitoreado_telefono && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Telefono monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitoreado_telefono ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitoreado_telefono: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.monitoreado_correo && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Correo monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.monitoreado_correo ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, monitoreado_correo: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.condicion && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Condición de monitoreado</div>
                      <select
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.condicion ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, condicion: e.target.value },
                          })
                        }
                      >
                        <option value="">Seleccionar</option>
                        <option value="DESIGNADO">Designado</option>
                        <option value="ENCARGADO">Encargado</option>
                      </select>
                    </label>
                  )}
                  {templateHeader.area && (
                    <label className="block md:col-span-2">
                      <div className="mb-1 text-[11px] text-white/60">Área que monitorea</div>
                      {templateHeader.area_options?.length ? (
                        <select
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          value={previewData.__header?.area ?? ""}
                          onChange={(e) =>
                            savePreview({
                              ...previewData,
                              __header: { ...previewData.__header, area: e.target.value },
                            })
                          }
                        >
                          {templateHeader.area_options.map((o: string) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          value={previewData.__header?.area ?? ""}
                          onChange={(e) =>
                            savePreview({
                              ...previewData,
                              __header: { ...previewData.__header, area: e.target.value },
                            })
                          }
                        />
                      )}
                    </label>
                  )}
                  {templateHeader.numero_visitas && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Numero de visitas a la IE</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.numero_visitas ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, numero_visitas: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.fecha_aplicacion && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Fecha de aplicacion</div>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__header?.fecha_aplicacion ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, fecha_aplicacion: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateHeader.hora_inicio && (
                    <div className="block">
                      <div className="mb-1 text-[11px] text-white/60">Hora de inicio</div>
                      <TimeField
                        ariaLabel="Hora de inicio"
                        value={previewData.__header?.hora_inicio ?? ""}
                        onChange={(value) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, hora_inicio: value },
                          })
                        }
                      />
                    </div>
                  )}
                  {templateHeader.hora_fin && (
                    <div className="block">
                      <div className="mb-1 text-[11px] text-white/60">Hora de fin</div>
                      <TimeField
                        ariaLabel="Hora de fin"
                        value={previewData.__header?.hora_fin ?? ""}
                        onChange={(value) =>
                          savePreview({
                            ...previewData,
                            __header: { ...previewData.__header, hora_fin: value },
                          })
                        }
                      />
                    </div>
                  )}
                  {(templateHeader.custom_fields ?? []).map((field: HeaderFieldDef) => (
                    <label
                      key={field.id}
                      className={`block ${field.type === "select" && field.options.length > 4 ? "md:col-span-2" : ""}`}
                    >
                      <div className="mb-1 text-[11px] text-white/60">
                        {field.label}
                        {field.required ? " *" : ""}
                      </div>
                      {field.type === "select" ? (
                        <select
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          value={previewData.__header?.custom_values?.[field.key] ?? ""}
                          onChange={(e) =>
                            savePreview({
                              ...previewData,
                              __header: {
                                ...previewData.__header,
                                custom_values: {
                                  ...(previewData.__header?.custom_values ?? {}),
                                  [field.key]: e.target.value,
                                },
                              },
                            })
                          }
                        >
                          <option value="">Seleccionar</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          inputMode={field.type === "number" ? "numeric" : undefined}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          value={previewData.__header?.custom_values?.[field.key] ?? ""}
                          placeholder={field.placeholder || field.label}
                          onChange={(e) =>
                            savePreview({
                              ...previewData,
                              __header: {
                                ...previewData.__header,
                                custom_values: {
                                  ...(previewData.__header?.custom_values ?? {}),
                                  [field.key]:
                                    field.type === "number" ? e.target.value.replace(/[^\d]/g, "") : e.target.value,
                                },
                              },
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
              {templateHeader.nivel_avance ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-semibold">Niveles de respuesta (Sí)</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-white/70">
                    {((templateHeader.nivel_avance_info ?? []).length
                      ? templateHeader.nivel_avance_info
                      : DEFAULT_NIVEL_INFO
                    ).map((x: any, idx: number) => (
                      <div
                        key={`${x.nivel}-${idx}`}
                        className="rounded-lg border border-white/10 bg-black/30 p-2"
                      >
                        <div className="text-[11px] text-white/60">Nivel {x.nivel}</div>
                        <div className="text-xs text-white/80">{x.descripcion}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {sections.map((s, sIndex) => (
                <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-semibold">{sectionRomanNumeral(sIndex, tablaMatrizFlags)}. {s.titulo}</div>
                  <div className="mt-3 space-y-3">
                    {(() => {
                      const sectionQuestions = questions.filter((q) => q.section_id === s.id);
                      const seenSubtitulos = new Set<string>();
                      let runCounter = 0;
                      let prevSub: string | null = null;
                      return sectionQuestions.map((q) => {
                      const showSubtitulo = !!q.subtitulo && !seenSubtitulos.has(q.subtitulo);
                      if (q.subtitulo) seenSubtitulos.add(q.subtitulo);
                      const curSub = q.subtitulo ?? null;
                      runCounter = curSub === prevSub ? runCounter + 1 : 1;
                      prevSub = curSub;
                      const displayNum = runCounter;
                      return (
                      <div key={q.id}>
                      {showSubtitulo && (
                        <div className="mb-1.5 mt-2 text-xs font-bold uppercase tracking-wide text-white/50">
                          {q.subtitulo}
                        </div>
                      )}
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-sm font-semibold">{displayNum}. {q.texto}</div>
                        <div className="mt-2">
                          {q.tipo === "yes_no" && (
                            <div className="flex gap-3 text-xs text-white/70">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`yn-${q.id}`}
                                  checked={previewData[q.id]?.yn === "SI"}
                                  onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "SI" } })}
                                />
                                Sí
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`yn-${q.id}`}
                                  checked={previewData[q.id]?.yn === "NO"}
                                  onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "NO", nivel: undefined } })}
                                />
                                No
                              </label>
                            </div>
                          )}
                          {q.tipo === "yes_no_nivel" && (
                            <div className="space-y-2 text-xs text-white/70">
                              <div className="flex gap-3">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`ynn-${q.id}`}
                                    checked={previewData[q.id]?.yn === "SI"}
                                    onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "SI" } })}
                                  />
                                  Sí
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`ynn-${q.id}`}
                                    checked={previewData[q.id]?.yn === "NO"}
                                    onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "NO", nivel: undefined } })}
                                  />
                                  No
                                </label>
                              </div>
                              {previewData[q.id]?.yn === "SI" ? (
                                <div className="flex flex-wrap gap-2">
                                  {(q.config_json?.levelLabels?.length
                                    ? q.config_json.levelLabels
                                    : Array.from({ length: q.config_json?.levels ?? 3 }, (_, i) => `Nivel ${i + 1}`)
                                  ).map((l: string, i: number) => (
                                    <label
                                      key={`${q.id}-lvl-${i}`}
                                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]"
                                    >
                                      <input
                                        type="radio"
                                        name={`nivel-${q.id}`}
                                        checked={previewData[q.id]?.nivel === l}
                                        onChange={() =>
                                          savePreview({
                                            ...previewData,
                                            [q.id]: { ...previewData[q.id], nivel: l },
                                          })
                                        }
                                      />
                                      {l}
                                    </label>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}
                          {q.tipo === "opciones" && (
                            <div className="mt-2 grid gap-2 text-xs text-white/70">
                              {(q.config_json?.options ?? []).map((opt: string, i: number) => (
                                <label key={`${q.id}-opt-${i}`} className="flex items-center gap-2">
                                  <input
                                    type={q.config_json?.multi ? "checkbox" : "radio"}
                                    name={`opt-${q.id}`}
                                    checked={
                                      q.config_json?.multi
                                        ? (previewData[q.id]?.options ?? []).includes(opt)
                                        : previewData[q.id]?.option === opt
                                    }
                                    onChange={(e) => {
                                      if (q.config_json?.multi) {
                                        const current = new Set(previewData[q.id]?.options ?? []);
                                        if (e.target.checked) current.add(opt);
                                        else current.delete(opt);
                                        savePreview({
                                          ...previewData,
                                          [q.id]: { ...previewData[q.id], options: Array.from(current) },
                                        });
                                      } else {
                                        savePreview({
                                          ...previewData,
                                          [q.id]: { ...previewData[q.id], option: opt },
                                        });
                                      }
                                    }}
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          )}
                          {q.tipo === "texto" && (
                            <textarea
                              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              placeholder="Respuesta..."
                              value={previewData[q.id]?.text ?? ""}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  [q.id]: { ...previewData[q.id], text: e.target.value },
                                })
                              }
                            />
                          )}
                          {q.tipo === "numero" && (
                            <input
                              type="number"
                              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              value={previewData[q.id]?.number ?? ""}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  [q.id]: { ...previewData[q.id], number: e.target.value },
                                })
                              }
                            />
                          )}
                          {q.tipo === "archivo_pdf" && (
                            <div className="mt-2 space-y-2 text-xs text-white/70">
                              <input
                                type="file"
                                accept="application/pdf"
                                className="block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                onChange={(e) =>
                                  savePreview({
                                    ...previewData,
                                    [q.id]: { ...previewData[q.id], fileName: e.target.files?.[0]?.name ?? "" },
                                  })
                                }
                              />
                              {previewData[q.id]?.fileName ? (
                                <div className="text-[11px] text-white/60">
                                  Archivo: {previewData[q.id].fileName}
                                </div>
                              ) : null}
                            </div>
                          )}
                          {q.tipo === "tabla_matriz" && (
                            <div className="mt-2 overflow-x-auto">
                              <table
                                className="border-collapse text-[11px]"
                                style={{ minWidth: 120 + (q.config_json?.cols ?? []).length * 70 }}
                              >
                                <thead>
                                  {(() => {
                                    const cols: string[] = q.config_json?.cols ?? [];
                                    const groups = groupMatrixCols(cols);
                                    if (!groups) {
                                      return (
                                        <tr>
                                          <th className="min-w-[120px] border border-white/10 bg-white/5 px-2 py-1 text-left"></th>
                                          {cols.map((col) => (
                                            <th key={col} className="min-w-[70px] border border-white/10 bg-white/5 px-2 py-1 text-center">
                                              {col}
                                            </th>
                                          ))}
                                        </tr>
                                      );
                                    }
                                    return (
                                      <>
                                        <tr>
                                          <th className="min-w-[120px] border border-white/10 bg-white/5 px-2 py-1 text-left" rowSpan={2}></th>
                                          {groups.map((g) => (
                                            <th
                                              key={g.group}
                                              colSpan={g.cols.length}
                                              className="border border-white/10 bg-white/5 px-2 py-1 text-center"
                                            >
                                              {g.group}
                                            </th>
                                          ))}
                                        </tr>
                                        <tr>
                                          {groups.flatMap((g) =>
                                            g.cols.map((label) => (
                                              <th
                                                key={`${g.group}-${label}`}
                                                className="min-w-[70px] border border-white/10 bg-white/5 px-2 py-1 text-center"
                                              >
                                                {label}
                                              </th>
                                            ))
                                          )}
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </thead>
                                <tbody>
                                  {(() => {
                                    const rows: string[] = q.config_json?.rows ?? [];
                                    const cols: string[] = q.config_json?.cols ?? [];
                                    const groups = groupMatrixCols(cols);
                                    return rows.map((row, i) => {
                                      const rowValues = cols.map((_c, j) => previewData[q.id]?.matrix?.[i]?.[j] ?? "");
                                      const { next: rowComputed, totalFlatIndices } = computeMatrixAutoTotals(groups, rowValues);
                                      return (
                                        <tr key={row}>
                                          <td className="min-w-[120px] border border-white/10 px-2 py-1 text-white/70">{row}</td>
                                          {cols.map((col, j) => {
                                            const isTotal = totalFlatIndices.has(j);
                                            return (
                                              <td key={col} className="min-w-[70px] border border-white/10 p-1">
                                                <input
                                                  type="number"
                                                  readOnly={isTotal}
                                                  tabIndex={isTotal ? -1 : undefined}
                                                  title={isTotal ? "Se calcula automáticamente" : undefined}
                                                  className={`w-full min-w-[58px] rounded-md border px-2 py-1 text-center text-xs ${
                                                    isTotal ? "border-white/5 bg-white/20 text-white/70" : "border-white/10 bg-black/30"
                                                  }`}
                                                  value={isTotal ? rowComputed[j] ?? "" : previewData[q.id]?.matrix?.[i]?.[j] ?? ""}
                                                  onChange={(e) => {
                                                    if (isTotal) return;
                                                    const rowsCount = rows.length;
                                                    const colsCount = cols.length;
                                                    const current = previewData[q.id]?.matrix ?? [];
                                                    const next: string[][] = Array.from({ length: rowsCount }, (_, ri) =>
                                                      Array.from({ length: colsCount }, (_, ci) => current[ri]?.[ci] ?? "")
                                                    );
                                                    next[i][j] = e.target.value;
                                                    next[i] = computeMatrixAutoTotals(groups, next[i]).next;
                                                    savePreview({ ...previewData, [q.id]: { ...previewData[q.id], matrix: next } });
                                                  }}
                                                />
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {q.config_json?.include_obs !== false && (
                            <div className="mt-3">
                              <div className="text-[11px] text-white/60">Observaciones</div>
                              <textarea
                                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                placeholder="Observaciones..."
                                value={previewData[q.id]?.obs ?? ""}
                                onChange={(e) =>
                                  savePreview({
                                    ...previewData,
                                    [q.id]: { ...previewData[q.id], obs: e.target.value },
                                  })
                                }
                              />
                            </div>
                          )}
                          {normalizeExtraFields(q.config_json?.extra_fields).map((field) => (
                            <div className="mt-3" key={`${q.id}-${field.label}`}>
                              <div className="text-[11px] text-white/60">{field.label}</div>
                              {field.mode === "elaboracion" ? (
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                  value={field.default_value ?? ""}
                                  readOnly
                                />
                              ) : (
                                <textarea
                                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                  placeholder={`${field.label}...`}
                                  value={previewData[q.id]?.extra?.[field.label] ?? ""}
                                  onChange={(e) =>
                                    savePreview({
                                      ...previewData,
                                      [q.id]: {
                                        ...previewData[q.id],
                                        extra: {
                                          ...(previewData[q.id]?.extra ?? {}),
                                          [field.label]: e.target.value,
                                        },
                                      },
                                    })
                                  }
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      </div>
                      );
                      });
                    })()}
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <div className="text-sm text-white/60">No hay secciones definidas.</div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold">Cierre</div>
                <div className="mt-2 grid gap-3 md:grid-cols-2 text-xs text-white/70">
                  {templateFooter.observacion && (
                    <label className="block md:col-span-2">
                      <div className="mb-1 text-[11px] text-white/60">Observación general</div>
                      <textarea
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.observacion ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, observacion: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.compromiso && (
                    <label className="block md:col-span-2">
                      <div className="mb-1 text-[11px] text-white/60">Compromiso general</div>
                      <textarea
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.compromiso ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, compromiso: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.lugar && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Lugar</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.lugar ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, lugar: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.fecha && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Fecha</div>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.fecha ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, fecha: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.docente_nombre && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Nombre monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.docente_nombre ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, docente_nombre: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.docente_dni && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">DNI monitoreado</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.docente_dni ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, docente_dni: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.monitor_nombre && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">Nombre monitor</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.monitor_nombre ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, monitor_nombre: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.monitor_dni && (
                    <label className="block">
                      <div className="mb-1 text-[11px] text-white/60">DNI monitor</div>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        value={previewData.__footer?.monitor_dni ?? ""}
                        onChange={(e) =>
                          savePreview({
                            ...previewData,
                            __footer: { ...previewData.__footer, monitor_dni: e.target.value },
                          })
                        }
                      />
                    </label>
                  )}
                  {templateFooter.firmas && (
                    <div className="md:col-span-2 mt-2 grid gap-4 md:grid-cols-2">
                      <div className="border-t border-white/30 pt-2 text-center text-[11px] text-white/60">
                        Firma monitoreado
                      </div>
                      <div className="border-t border-white/30 pt-2 text-center text-[11px] text-white/60">
                        Firma monitor
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {questions.length === 0 && (
                <div className="text-sm text-white/60">Aún no hay preguntas para previsualizar.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
