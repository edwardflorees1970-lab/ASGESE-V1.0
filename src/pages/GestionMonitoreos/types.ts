export type Solicitud = {
  id: string;
  created_by: string;
  nombre: string;
  detalle: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  cdd?: boolean | null;
  status: string;
  motivo_rechazo: string | null;
  approved_lv1_by: string | null;
  approved_by: string | null;
  created_at: string;
};

export type Template = {
  id: string;
  solicitud_id: string;
  titulo: string;
  codigo: string;
  subtitulo?: string | null;
  header_config?: any;
  footer_config?: any;
  orden: number;
};

export type GlobalTemplateOption = Template & {
  monitoreo_nombre: string;
  monitoreo_codigo: string;
  metadata: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Question = {
  id: string;
  template_id: string;
  section_id?: string | null;
  tipo: string;
  texto: string;
  subtitulo?: string | null;
  orden: number;
  orden_in_section?: number | null;
  required: boolean;
  config_json: any;
};

export type Section = {
  id: string;
  template_id: string;
  titulo: string;
  orden: number;
  subtitulos?: string[] | null;
};

export type InstitucionLite = {
  id: string;
  nombre: string;
  codigo_modular: string;
  codigo_local: string | null;
};

export type DeleteFichaResumen = {
  titulo: string;
  registros: number;
};

export type DeleteMonSummary = {
  monitoreoNombre: string;
  monitoreoCodigo: string;
  fichas: DeleteFichaResumen[];
  totalRegistros: number;
  totalAsignacionesMonitor: number;
  totalAsignacionesIe: number;
};

export type ExtraFieldCfg = {
  label: string;
  mode: "registro" | "elaboracion";
  default_value?: string | null;
};
