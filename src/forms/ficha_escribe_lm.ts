export type AreaMonitoreo = "COMUNICACION" | "QUECHUA" | "INGLES";
export type CondicionDocente = "NOMBRADO" | "CONTRATADO";

export type NivelAvance = 1 | 2 | 3;

export type QuestionGroupKey = "PLANIFICACION" | "TEXTUALIZACION" | "EVALUACION";

export type QuestionItem = {
  id: string;           // ID interno único (no depende del número)
  numero: string;       // número visible (puede repetirse en papel, acá lo controlamos)
  texto: string;
  group: QuestionGroupKey;
};

export type FichaMonitoreoDef = {
  key: string;
  titulo: string;
  encabezado: {
    campos: Array<{
      key:
        | "institucion_educativa"
        | "lugar_ie"
        | "director_monitor"
        | "docente"
        | "condicion_docente"
        | "area_monitoreo";
      label: string;
      type: "text" | "select";
      options?: Array<{ value: string; label: string }>;
    }>;
    nivel_avance_info: Array<{ nivel: NivelAvance; descripcion: string }>;
  };
  preguntas: QuestionItem[];
  pie: {
    observacion_general: boolean;
    compromiso: boolean;
    lugar_y_fecha: boolean;
    firmas: boolean;
  };
};

export const FICHA_ESCRIBE_LM: FichaMonitoreoDef = {
  key: "FICHA_ESCRIBE_LENGUA_MATERNA",
  titulo:
    "FICHA DE MONITOREO DE LA SESIÓN DE APRENDIZAJE DE LA COMPETENCIA ESCRIBE DIVERSOS TIPOS DE TEXTOS EN SU LENGUA MATERNA - ÁREA - COMUNICACIÓN ESPAÑOL Y QUECHUA - ÁREA DE INGLÉS.",

  encabezado: {
    campos: [
      { key: "institucion_educativa", label: "Institución Educativa", type: "text" },
      { key: "lugar_ie", label: "Lugar donde se encuentra la IE", type: "text" },
      { key: "director_monitor", label: "Director(a) o Monitor(a)", type: "text" },
      { key: "docente", label: "Apellidos y nombres del(a) docente", type: "text" },
      {
        key: "condicion_docente",
        label: "Condición del docente",
        type: "select",
        options: [
          { value: "NOMBRADO", label: "Nombrado" },
          { value: "CONTRATADO", label: "Contratado" },
        ],
      },
      {
        key: "area_monitoreo",
        label: "Área que monitorea",
        type: "select",
        options: [
          { value: "COMUNICACION", label: "Comunicación" },
          { value: "QUECHUA", label: "Quechua" },
          { value: "INGLES", label: "Inglés" },
        ],
      },
    ],
    nivel_avance_info: [
      { nivel: 1, descripcion: "Cumple en un nivel incipiente con los requerimientos del ítem." },
      { nivel: 2, descripcion: "Cumple parcialmente con los requerimientos del ítem." },
      { nivel: 3, descripcion: "Cumple con lo previsto en el ítem." },
    ],
  },

  preguntas: [
    // PLANIFICACIÓN
    {
      id: "p01",
      numero: "01",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes lean un texto o textos relacionado al tema que producirán de forma escrita, identificando la estructura y otras características importantes?",
    },
    {
      id: "p02",
      numero: "02",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes lean textos con la finalidad de alimentar sus conocimientos previos relacionados al tipo de texto que escribirá?",
    },
    {
      id: "p03a",
      numero: "03",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategia(s) para que las y los estudiantes planteen el propósito del texto que van a escribir?",
    },
    {
      id: "p03b",
      numero: "03",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes identifiquen el destinatario del texto que escribirán?",
    },
    {
      id: "p04",
      numero: "04",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado actividades para que las y los estudiantes determinen el tema del texto que escribirán?",
    },
    {
      id: "p05",
      numero: "05",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para generar ideas en relación al tema y tipo de texto que escribirán?",
    },
    {
      id: "p06",
      numero: "06",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para establecer objetivos que dirigirán el proceso de escritura?",
    },
    {
      id: "p07",
      numero: "07",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado actividades para que los estudiantes seleccionen el tipo de registro (o lenguaje) que utilizarán para redactar el texto, teniendo en cuenta el destinatario para el que estará dirigido el texto?",
    },
    {
      id: "p08",
      numero: "08",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado actividades para que los estudiantes organicen sus ideas (elaboren un esquema de ideas) de acuerdo a la estructura y tipo de texto que escribirán?",
    },

    // TEXTUALIZACIÓN
    {
      id: "p09",
      numero: "09",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado estrategias para organizar las ideas (en párrafos, subtítulos, estrofas u otros) teniendo como referente la estructura del tipo de texto que está redactando?",
    },
    {
      id: "p10",
      numero: "10",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para desarrollar contenidos de recursos gramaticales, teniendo en cuenta el trabajo basado en el paradigma del constructivismo, que después serán usados al momento de redactar el texto?",
    },
    {
      id: "p11",
      numero: "11",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para desarrollar contenidos de recursos ortográficos, teniendo en cuenta el trabajo basado en el paradigma del constructivismo, que después serán usados al momento de redactar el texto?",
    },
    {
      id: "p12",
      numero: "12",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para desarrollar contenidos de recursos textuales, teniendo en cuenta el trabajo basado en el paradigma del constructivismo, que después serán usados al momento de redactar el texto?",
    },
    {
      id: "p13",
      numero: "13",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para que los estudiantes redacten el borrador del texto, teniendo en cuenta lo planificado (en el esquema de ideas) de acuerdo al tipo de texto que escribirán?",
    },
    {
      id: "p14",
      numero: "14",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planificado estrategias para trabajar la coherencia en el texto que redactarán los estudiantes?",
    },
    {
      id: "p15",
      numero: "15",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planificado estrategias para trabajar la cohesión en el texto que redactarán los estudiantes?",
    },
    {
      id: "p16",
      numero: "16",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes no se aparten del propósito de escritura del texto que están redactando?",
    },

    // EVALUACIÓN (según tu lista: 24–27)
    {
      id: "p24",
      numero: "24",
      group: "EVALUACION",
      texto:
        "¿Ha redactado criterios de evaluación teniendo en cuenta que describan las características o cualidades de aquello que se quiere valorar y que las y los estudiantes deben demostrar en sus actuaciones ante una situación en un contexto determinado?",
    },
    {
      id: "p25",
      numero: "25",
      group: "EVALUACION",
      texto:
        "Los criterios de evaluación, ¿se han elaborado a partir de los estándares y sus desempeños, incluyendo las capacidades de la competencia que se requiere movilizar según la situación?",
    },
    {
      id: "p26",
      numero: "26",
      group: "EVALUACION",
      texto:
        "Ha planteado estrategias para desarrollar la retroalimentación pertinente y oportuna durante el desarrollo de los procesos didácticos de la competencia.",
    },
    {
      id: "p27",
      numero: "27",
      group: "EVALUACION",
      texto:
        "¿Ha elaborado un instrumento de evaluación que le permita determinar el nivel de logro en relación a los criterios que ha planteado?",
    },
  ],

  pie: {
    observacion_general: true,
    compromiso: true,
    lugar_y_fecha: true,
    firmas: true,
  },
};

// Helpers opcionales (por si luego quieres títulos bonitos por grupo)
export const GROUP_LABEL: Record<QuestionGroupKey, string> = {
  PLANIFICACION: "Planificación",
  TEXTUALIZACION: "Textualización",
  EVALUACION: "Evaluación",
};
