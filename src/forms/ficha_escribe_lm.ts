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
    // ---------------- PLANIFICACI?N (01-09) ----------------
    {
      id: "p01",
      numero: "01",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes lean un texto o textos relacionado al tema que producir?n de forma escrita, identificando la estructura y otras caracter?sticas importantes?",
    },
    {
      id: "p02",
      numero: "02",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes lean textos con la finalidad de alimentar sus conocimientos previos relacionados al tipo de texto que escribir?n?",
    },
    {
      id: "p03",
      numero: "03",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado estrategia(s) para que las y los estudiantes planteen el prop?sito del texto que van a escribir?",
    },
    {
      id: "p04",
      numero: "04",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes identifiquen el destinatario del texto que escribir?n?",
    },
    {
      id: "p05",
      numero: "05",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado actividades para que las y los estudiantes determinen el tema del texto que escribir?n?",
    },
    {
      id: "p06",
      numero: "06",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado estrategias para generar ideas en relaci?n al tema y tipo de texto que escribir?n?",
    },
    {
      id: "p07",
      numero: "07",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado estrategias para establecer objetivos que dirigir?n el proceso de escritura?",
    },
    {
      id: "p08",
      numero: "08",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado actividades para que los estudiantes seleccionen el tipo de registro (o lenguaje) que utilizar?n para redactar el texto, teniendo en cuenta el destinatario para el que estar? dirigido el texto?",
    },
    {
      id: "p09",
      numero: "09",
      group: "PLANIFICACION",
      texto:
        "?Ha planteado actividades para que los estudiantes organicen sus ideas (elaboren un esquema de ideas) de acuerdo a la estructura y tipo de texto que escribir?n?",
    },

    // ---------------- TEXTUALIZACI?N (10-17) ----------------
    {
      id: "p10",
      numero: "10",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planteado estrategias para organizar las ideas (en p?rrafos, subt?tulos, estrofas u otros) teniendo como referente la estructura del tipo de texto que est? redactando?",
    },
    {
      id: "p11",
      numero: "11",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planteado actividades para desarrollar contenidos de recursos gramaticales, teniendo en cuenta el trabajo basado en el paradigma del constructivismo, que despu?s ser?n usados al momento de redactar el texto?",
    },
    {
      id: "p12",
      numero: "12",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planteado actividades para desarrollar contenidos de recursos ortogr?ficos, teniendo en cuenta el trabajo basado en el paradigma del constructivismo, que despu?s ser?n usados al momento de redactar el texto?",
    },
    {
      id: "p13",
      numero: "13",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planteado actividades para desarrollar contenidos de recursos textuales, teniendo en cuenta el trabajo basado en el paradigma del constructivismo, que despu?s ser?n usados al momento de redactar el texto?",
    },
    {
      id: "p14",
      numero: "14",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planteado actividades para que los estudiantes redacten el borrador del texto, teniendo en cuenta lo planificado (en el esquema de ideas) de acuerdo al tipo de texto que escribir?n?",
    },
    {
      id: "p15",
      numero: "15",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planificado estrategias para trabajar la coherencia en el texto que redactar?n los estudiantes?",
    },
    {
      id: "p16",
      numero: "16",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planificado estrategias para trabajar la cohesi?n en el texto que redactar?n los estudiantes?",
    },
    {
      id: "p17",
      numero: "17",
      group: "TEXTUALIZACION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes no se aparten del prop?sito de escritura del texto que est?n redactando?",
    },

    // ---------------- REVISI?N (18-24) ----------------
    {
      id: "p18",
      numero: "18",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que los estudiantes comparen su texto con el prop?sito propuesto en la planificaci?n?",
    },
    {
      id: "p19",
      numero: "19",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes lean el texto que han redactado y lo mejoren en cuanto al uso de recursos ortogr?ficos?",
    },
    {
      id: "p20",
      numero: "20",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes lean el texto que han redactado y lo mejoren en cuanto al uso de recursos gramaticales?",
    },
    {
      id: "p21",
      numero: "21",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes lean el texto que han redactado y lo mejoren en cuanto al uso de recursos textuales?",
    },
    {
      id: "p22",
      numero: "22",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes corrijan los problemas de cohesi?n en el texto que ha redactado?",
    },
    {
      id: "p23",
      numero: "23",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes corrijan los problemas de coherencia en el texto que ha redactado?",
    },
    {
      id: "p24",
      numero: "24",
      group: "REVISION",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes editen, de forma creativa, el texto que presentar?n?",
    },

    // ---------------- EVALUACI?N (25-28) ----------------
    {
      id: "p25",
      numero: "25",
      group: "EVALUACION",
      texto:
        "?Ha redactado criterios de evaluaci?n teniendo en cuenta que describan las caracter?sticas o cualidades de aquello que se quiere valorar y que las y los estudiantes deben demostrar en sus actuaciones ante una situaci?n en un contexto determinado?",
    },
    {
      id: "p26",
      numero: "26",
      group: "EVALUACION",
      texto:
        "Los criterios de evaluaci?n, ?se han elaborado a partir de los est?ndares y sus desempe?os, incluyendo las capacidades de la competencia que se requiere movilizar seg?n la situaci?n?",
    },
    {
      id: "p27",
      numero: "27",
      group: "EVALUACION",
      texto:
        "?Ha planteado estrategias para desarrollar la retroalimentaci?n pertinente y oportuna durante el desarrollo de los procesos did?cticos de la competencia?",
    },
    {
      id: "p28",
      numero: "28",
      group: "EVALUACION",
      texto:
        "?Ha elaborado un instrumento de evaluaci?n que le permita determinar el nivel de logro en relaci?n a los criterios que ha planteado?",
    },
  ]] as QuestionItem[],
};
