// src/forms/ficha_escribe_lm.ts

export type NivelAvance = 1 | 2 | 3;

export type QuestionGroup =
  | "PLANIFICACION"
  | "TEXTUALIZACION"
  | "REVISION"
  | "EVALUACION";

export const GROUP_LABEL: Record<QuestionGroup, string> = {
  PLANIFICACION: "Planificación",
  TEXTUALIZACION: "Textualización",
  REVISION: "Revisión",
  EVALUACION: "Evaluación",
};

export type QuestionItem = {
  id: string;      // p01..p27
  numero: string;  // "01".."27"
  texto: string;
  group: QuestionGroup;
};

export const FICHA_ESCRIBE_LM = {
  key: "lengua-materna-escribe",
  monitoreo: "lengua-materna",
  titulo:
    "FICHA DE MONITOREO DE LA SESIÓN DE APRENDIZAJE DE LA COMPETENCIA ESCRIBE DIVERSOS TIPOS DE TEXTOS EN SU LENGUA MATERNA - ÁREA - COMUNICACIÓN ESPAÑOL Y QUECHUA - ÁREA DE INGLÉS.",
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
    // ---------------- PLANIFICACIÓN (01-08) ----------------
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
        "¿Ha planteado estrategia(s) para que las y los estudiantes planteen el propósito del texto que van a escribir?",
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
        "¿Ha planteado actividades para que los estudiantes seleccionen el tipo de registro (o lenguaje) que utilizarán para redactar el texto, teniendo en cuenta el destinatario para el que estará dirigido el texto?",
    },

    // ---------------- TEXTUALIZACIÓN (09-16) ----------------
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

    // ---------------- REVISIÓN (17-23) ----------------
    {
      id: "p17",
      numero: "17",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategas para que los estudiantes comparen su texto con el propósito propuesto en la planificación?",
    },
    {
      id: "p18",
      numero: "18",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes lean el texto que han redactado y lo mejoren en cuanto al uso de recursos ortográficos?",
    },
    {
      id: "p19",
      numero: "19",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes lean el texto que han redactado y lo mejoren en cuanto al uso de recursos gramaticales?",
    },
    {
      id: "p20",
      numero: "20",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes lean el texto que han redactado y lo mejoren en cuanto al uso de recursos textuales?",
    },
    {
      id: "p21",
      numero: "21",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes corrijan los problemas de cohesión en el texto que ha redactado?",
    },
    {
      id: "p22",
      numero: "22",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes corrijan los problemas de coherencia en el texto que ha redactado?",
    },
    {
      id: "p23",
      numero: "23",
      group: "REVISION",
      texto:
        "¿Ha planteado estrategias para que las y los estudiantes editen, de forma creativa, el texto que presentarán?",
    },

    // ---------------- EVALUACIÓN (24-27) ----------------
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
  ] as QuestionItem[],
};
