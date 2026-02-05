// src/forms/ficha_oral_lm.ts

export type NivelAvance = 1 | 2 | 3;

export type QuestionGroup =
  | "ANTES_ORALIDAD"
  | "DURANTE_ORALIDAD"
  | "DESPUES_ORALIDAD"
  | "EVALUACION";

export const GROUP_LABEL: Record<QuestionGroup, string> = {
  ANTES_ORALIDAD: "Antes del texto oral",
  DURANTE_ORALIDAD: "Durante el texto oral",
  DESPUES_ORALIDAD: "Después del texto oral",
  EVALUACION: "Evaluación",
};

export type QuestionItem = {
  id: string; // p01..p26
  numero: string; // "01".."26"
  texto: string;
  group: QuestionGroup;
};

export const FICHA_ORAL_LM = {
  key: "lengua-materna-oralidad",
  monitoreo: "lengua-materna",
  titulo:
    "FICHA DE MONITOREO DE LA SESIÓN DE APRENDIZAJE DE LA COMPETENCIA SE COMUNICA ORALMENTE EN SU LENGUA MATERNA",
  area: "Comunicación / Quechua / Inglés",

  encabezado: {
    nivel_avance_info: [
      {
        nivel: 1,
        descripcion: "Cumple en un nivel incipiente con los requerimientos del ítem.",
      },
      {
        nivel: 2,
        descripcion: "Cumple parcialmente con los requerimientos del ítem.",
      },
      {
        nivel: 3,
        descripcion: "Cumple con lo previsto en el ítem.",
      },
    ],
  },

  preguntas: [
    // ---------------- ANTES DEL TEXTO ORAL (01-11) ----------------
    {
      id: "p01",
      numero: "01",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes lean un texto o textos relacionado al que producir\u00e1n para su discurso oral, identificando la estructura y otras caracter\u00edsticas importantes?",
    },
    {
      id: "p02",
      numero: "02",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes indaguen y alimenten sus conocimientos previos respecto al tema que tratar\u00e1n en su discurso oral?",
    },
    {
      id: "p03",
      numero: "03",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para generar el prop\u00f3sito comunicativo del texto oral que las y los estudiantes trabajar\u00e1n?",
    },
    {
      id: "p04",
      numero: "04",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para movilizar saberes previos de acuerdo a la actividad que realizar\u00e1n las y los estudiantes?",
    },
    {
      id: "p05",
      numero: "05",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes realicen el planteamiento del tema del discurso oral que presentar\u00e1n?",
    },
    {
      id: "p06",
      numero: "06",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias que orienten a las y los estudiantes a desarrollar su capacidad de adecuaci\u00f3n de acuerdo a las o los oyentes que tendr\u00e1: \u00bfQu\u00e9 registro usar\u00e1?",
    },
    {
      id: "p07",
      numero: "07",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes presenten las ideas del discurso oral que presentar\u00e1n, respetando la estructura del mismo? Puede ser a trav\u00e9s de una lluvia de ideas u otro.",
    },
    {
      id: "p08",
      numero: "08",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes presenten un esquema de ideas del texto que presentar\u00e1n en su discurso oral, respetando la estructura del mismo?",
    },
    {
      id: "p09",
      numero: "09",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes planifiquen el uso de recursos verbales, paraverbales y/o verbales?",
    },
    {
      id: "p10",
      numero: "10",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes discriminen el criterio de la entonaci\u00f3n seg\u00fan el sentido de los enunciados que formular\u00e1n?",
    },
    {
      id: "p11",
      numero: "11",
      group: "ANTES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes ensayen su presentaci\u00f3n oral?",
    },

    // ---------------- DURANTE EL TEXTO ORAL (12-19) ----------------
    {
      id: "p12",
      numero: "12",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes recuerden el prop\u00f3sito de los discursos orales que presentar\u00e1n sus compa\u00f1eros y compa\u00f1eras?",
    },
    {
      id: "p13",
      numero: "13",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para acordar con las y los estudiantes sobre los aspectos a tener en cuenta en su rol de hablantes y oyentes?",
    },
    {
      id: "p14",
      numero: "14",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado consignas claras para orientar la participaci\u00f3n de las y los estudiantes?",
    },
    {
      id: "p15",
      numero: "15",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes que act\u00faan como oyentes escriban apuntes mientras van escuchando lo que su interlocutor est\u00e1 presentando? Puede ser preguntas gu\u00eda que permitan orientar sus apuntes a s\u00edntesis y no a intentar copiar el discurso en su totalidad.",
    },
    {
      id: "p16",
      numero: "16",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfHa determinado normas de escucha activa?",
    },
    {
      id: "p17",
      numero: "17",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfInvita y motiva la participaci\u00f3n de las y los estudiantes durante el desarrollo del texto oral?",
    },
    {
      id: "p18",
      numero: "18",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfAct\u00faa como moderador(a) en algunas situaciones de interacci\u00f3n como producto del desarrollo de la clase de oralidad?",
    },
    {
      id: "p19",
      numero: "19",
      group: "DURANTE_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes asuman el rol de moderador(a) durante el desarrollo de la clase de oralidad?",
    },

    // ---------------- DESPU?S DEL TEXTO ORAL (20-22) ----------------
    {
      id: "p20",
      numero: "20",
      group: "DESPUES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias que le permiten al o a la estudiante (es) expresar opiniones sobre el texto que escucharon?",
    },
    {
      id: "p21",
      numero: "21",
      group: "DESPUES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias que le permiten al o a la estudiante evaluar las posturas y emociones de su interlocutor, llev\u00e1ndoles a reflexionar sobre el timbre de voz utilizado, la entonaci\u00f3n y si sus ideas se relacionaban unas con otras?",
    },
    {
      id: "p22",
      numero: "22",
      group: "DESPUES_TEXTO_ORAL",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes asuman una postura frente a los mensajes que han escuchado en los discursos verbales?",
    },

    // ---------------- EVALUACI?N (23-26) ----------------
    {
      id: "p23",
      numero: "23",
      group: "EVALUACION",
      texto:
        "\u00bfHa redactado criterios de evaluaci\u00f3n teniendo en cuenta que describen las caracter\u00edsticas o cualidades de aquello que se quiere valorar y que las y los estudiantes deben demostrar en sus actuaciones ante una situaci\u00f3n en un contexto determinado?",
    },
    {
      id: "p24",
      numero: "24",
      group: "EVALUACION",
      texto:
        "\u00bfHa planteado estrategias para desarrollar la retroalimentaci\u00f3n pertinente y oportuna durante el desarrollo de los procesos did\u00e1cticos de la competencia?",
    },
    {
      id: "p25",
      numero: "25",
      group: "EVALUACION",
      texto:
        "Los criterios de evaluaci\u00f3n, \u00bfse han elaborado a partir de los est\u00e1ndares y sus desempe\u00f1os, incluyendo las capacidades de la competencia que se requiere movilizar seg\u00fan la situaci\u00f3n?",
    },
    {
      id: "p26",
      numero: "26",
      group: "EVALUACION",
      texto:
        "\u00bfHa elaborado un instrumento de evaluaci\u00f3n que le permita determinar el nivel de logro en relaci\u00f3n a los criterios que ha planteado?",
    },
  ] as QuestionItem[],
};
