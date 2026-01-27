// src/forms/ficha_escribe_lm.ts

export type NivelAvance = 1 | 2 | 3;

export type QuestionGroup =
  | "PLANIFICACION"
  | "TEXTUALIZACION"
  | "EVALUACION";

export const GROUP_LABEL: Record<QuestionGroup, string> = {
  PLANIFICACION: "Planificación",
  TEXTUALIZACION: "Textualización",
  EVALUACION: "Evaluación",
};

export type QuestionItem = {
  id: string;
  numero: string;
  texto: string;
  group: QuestionGroup;
};

export const FICHA_ESCRIBE_LM = {
  key: "lengua-materna-escribe",
  monitoreo: "lengua-materna",
  titulo:
    "FICHA DE MONITOREO DE LA SESIÓN DE APRENDIZAJE DE LA COMPETENCIA ESCRIBE DIVERSOS TIPOS DE TEXTOS EN SU LENGUA MATERNA",
  area: "Comunicación / Quechua / Inglés",

  encabezado: {
    nivel_avance_info: [
      {
        nivel: 1,
        descripcion:
          "Cumple en un nivel incipiente con los requerimientos del ítem.",
      },
      {
        nivel: 2,
        descripcion:
          "Cumple parcialmente con los requerimientos del ítem.",
      },
      {
        nivel: 3,
        descripcion:
          "Cumple con lo previsto en el ítem.",
      },
    ],
  },

  preguntas: [
    // ---------------- PLANIFICACIÓN ----------------
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
      id: "p03",
      numero: "03",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes planteen el propósito del texto que van a escribir?",
    },
    {
      id: "p04",
      numero: "04",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes identifiquen el destinatario del texto que escribirán?",
    },
    {
      id: "p05",
      numero: "05",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado actividades para que las y los estudiantes determinen el tema del texto que escribirán?",
    },
    {
      id: "p06",
      numero: "06",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para generar ideas en relación al tema y tipo de texto que escribirán?",
    },
    {
      id: "p07",
      numero: "07",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado estrategias para establecer objetivos que dirigirán el proceso de escritura?",
    },
    {
      id: "p08",
      numero: "08",
      group: "PLANIFICACION",
      texto:
        "¿Ha planteado actividades para que los estudiantes organicen sus ideas de acuerdo a la estructura y tipo de texto?",
    },

    // ---------------- TEXTUALIZACIÓN ----------------
    {
      id: "p09",
      numero: "09",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado estrategias para organizar las ideas en párrafos, subtítulos u otros, según el tipo de texto?",
    },
    {
      id: "p10",
      numero: "10",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para desarrollar recursos gramaticales que luego serán usados al redactar?",
    },
    {
      id: "p11",
      numero: "11",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para desarrollar recursos ortográficos que luego serán usados al redactar?",
    },
    {
      id: "p12",
      numero: "12",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para desarrollar recursos textuales que luego serán usados al redactar?",
    },
    {
      id: "p13",
      numero: "13",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado actividades para que los estudiantes redacten el borrador del texto?",
    },
    {
      id: "p14",
      numero: "14",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planificado estrategias para trabajar la coherencia del texto?",
    },
    {
      id: "p15",
      numero: "15",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planificado estrategias para trabajar la cohesión del texto?",
    },
    {
      id: "p16",
      numero: "16",
      group: "TEXTUALIZACION",
      texto:
        "¿Ha planteado estrategias para que los estudiantes no se aparten del propósito de escritura?",
    },

    // ---------------- EVALUACIÓN ----------------
    {
      id: "p24",
      numero: "24",
      group: "EVALUACION",
      texto:
        "¿Ha redactado criterios de evaluación que describan las características a valorar?",
    },
    {
      id: "p25",
      numero: "25",
      group: "EVALUACION",
      texto:
        "¿Los criterios de evaluación se han elaborado a partir de los estándares y desempeños?",
    },
    {
      id: "p26",
      numero: "26",
      group: "EVALUACION",
      texto:
        "¿Ha planteado estrategias de retroalimentación pertinente y oportuna?",
    },
    {
      id: "p27",
      numero: "27",
      group: "EVALUACION",
      texto:
        "¿Ha elaborado un instrumento de evaluación que determine el nivel de logro?",
    },
  ] as QuestionItem[],
};
