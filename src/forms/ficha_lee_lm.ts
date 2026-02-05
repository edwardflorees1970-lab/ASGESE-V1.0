// src/forms/ficha_lee_lm.ts

export type NivelAvance = 1 | 2 | 3;

export type QuestionGroup =
  | "ANTES_LECTURA"
  | "DURANTE_LECTURA"
  | "DESPUES_LECTURA"
  | "EVALUACION";

export const GROUP_LABEL: Record<QuestionGroup, string> = {
  ANTES_LECTURA: "Antes de la lectura",
  DURANTE_LECTURA: "Durante la lectura",
  DESPUES_LECTURA: "Después de la lectura",
  EVALUACION: "Evaluación",
};

export type QuestionItem = {
  id: string; // p01..p21
  numero: string; // "01".."21"
  texto: string;
  group: QuestionGroup;
};

export const FICHA_LEE_LM = {
  key: "lengua-materna-lee",
  monitoreo: "lengua-materna",
  titulo:
    "FICHA DE MONITOREO DE LA SESIÓN DE APRENDIZAJE DE LA COMPETENCIA LEE DIVERSOS TIPOS DE TEXTOS ESCRITOS EN SU LENGUA MATERNA",
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
    // ---------------- ANTES DE LA LECTURA (01-04) ----------------
    {
      id: "p01",
      numero: "01",
      group: "ANTES_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para identificar el prop\u00f3sito de la lectura con preguntas como: \u00bfPara qu\u00e9 voy a leer?, \u00bfes relevante para lo que necesito?",
    },
    {
      id: "p02",
      numero: "02",
      group: "ANTES_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para movilizar los saberes previos de las y los estudiantes, en relaci\u00f3n al tema del texto que leer\u00e1n?",
    },
    {
      id: "p03",
      numero: "03",
      group: "ANTES_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para elaborar predicciones o lanzar hip\u00f3tesis sobre el contenido del texto, a partir de los indicios que ofrece el texto que leer\u00e1n las y los estudiantes? (\u00bfQu\u00e9 ideas tiene acerca del tema relacionado con el texto?, \u00bfQu\u00e9 ideas ha manifestado el autor en otros de sus textos?, \u00bfde qu\u00e9 tratar\u00e1 el texto?, \u00bfpor qu\u00e9 crees eso?, \u00bfQu\u00e9 piensan ustedes?)",
    },
    {
      id: "p04",
      numero: "04",
      group: "ANTES_LECTURA",
      texto:
        "\u00bfHa planteado estrategias que motiven la lectura del texto que leer\u00e1n las y los estudiantes?",
    },

    // ---------------- DURANTE LA LECTURA (05-13) ----------------
    {
      id: "p05",
      numero: "05",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para leer el texto utilizando diversas formas de lectura, como: lectura silenciosa, en voz alta, etc.?",
    },
    {
      id: "p06",
      numero: "06",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que durante la lectura los estudiantes, despu\u00e9s de leer una parte del texto, puedan inferir o formular hip\u00f3tesis acerca de qu\u00e9 continuar\u00e1?",
    },
    {
      id: "p07",
      numero: "07",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias relacionadas a aclarar el texto en determinados momentos del proceso de la lectura?",
    },
    {
      id: "p08",
      numero: "08",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes, despu\u00e9s de una lectura total del texto, puedan aplicar estrategias de comprensi\u00f3n como: subrayado, sumillado, reconocimiento de ideas principales por p\u00e1rrafos, resumen, etc.?",
    },
    {
      id: "p09",
      numero: "09",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes lean dos textos (del mismo contenido o diferentes) con la finalidad de desarrollar la comparaci\u00f3n intertextual?",
    },
    {
      id: "p10",
      numero: "10",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes identifiquen si las ideas del texto le\u00eddo est\u00e1n cohesionadas?",
    },
    {
      id: "p11",
      numero: "11",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes identifiquen si las ideas del texto le\u00eddo tienen coherencia?",
    },
    {
      id: "p12",
      numero: "12",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que, en caso de realizar la lectura de dos textos (lectura intertextual) de autores diferentes, los estudiantes identifiquen ideas comunes entre ambas posturas o ideas contrarias? (\u00bfEn qu\u00e9 ideas coinciden? \u00bfEn qu\u00e9 enfatiza m\u00e1s un autor que el otro? \u00bfEn qu\u00e9 se pueden diferenciar?, etc.)",
    },
    {
      id: "p13",
      numero: "13",
      group: "DURANTE_LECTURA",
      texto:
        "\u00bfHa planteado estrategias para que las y los estudiantes identifiquen el tipo de texto que leen?",
    },

    // ---------------- DESPU?S DE LA LECTURA (14-16) ----------------
    {
      id: "p14",
      numero: "14",
      group: "DESPUES_LECTURA",
      texto:
        "\u00bfHa planteado preguntas que demandan la necesidad en las y los estudiantes de ubicar o localizar informaci\u00f3n en el texto, que les permita encontrar ideas principales, orden de acciones, personajes principales y secundarios e identificar p\u00e1rrafos del texto, etc.?",
    },
    {
      id: "p15",
      numero: "15",
      group: "DESPUES_LECTURA",
      texto:
        "\u00bfHa planteado preguntas que demandan en las y los estudiantes realizar inferencias en base al contenido del texto, con la finalidad de que reconstruyan el significado del texto relacion\u00e1ndolo con sus experiencias personales y conocimientos previos; a partir de ello formulen conjeturas e hip\u00f3tesis, saquen conclusiones e interpreten?",
    },
    {
      id: "p16",
      numero: "16",
      group: "DESPUES_LECTURA",
      texto:
        "\u00bfHa planteado preguntas que demandan en las y los estudiantes dar opiniones, reflexionar sobre el contenido o la forma, as\u00ed como asumir una posici\u00f3n sobre el contenido del texto, con la finalidad de que emitan juicios y opiniones fundamentadas y acepten o rechacen lo planteado por el autor?",
    },

    // ---------------- EVALUACI?N (17-20) ----------------
    {
      id: "p17",
      numero: "17",
      group: "EVALUACION",
      texto:
        "\u00bfHa redactado criterios de evaluaci\u00f3n teniendo en cuenta que describen las caracter\u00edsticas o cualidades de aquello que se quiere valorar y que las y los estudiantes deben demostrar en sus actuaciones ante una situaci\u00f3n en un contexto determinado?",
    },
    {
      id: "p18",
      numero: "18",
      group: "EVALUACION",
      texto:
        "\u00bfHa planteado estrategias para desarrollar la retroalimentaci\u00f3n pertinente y oportuna durante el desarrollo de los procesos did\u00e1cticos de la competencia?",
    },
    {
      id: "p19",
      numero: "19",
      group: "EVALUACION",
      texto:
        "Los criterios de evaluaci\u00f3n, \u00bfse han elaborado a partir de los est\u00e1ndares y sus desempe\u00f1os incluyendo las capacidades de la competencia que se requiere movilizar seg\u00fan la situaci\u00f3n?",
    },
    {
      id: "p20",
      numero: "20",
      group: "EVALUACION",
      texto:
        "\u00bfHa elaborado un instrumento de evaluaci\u00f3n que le permita determinar el nivel de logro en relaci\u00f3n a los criterios que ha planteado?",
    },
  ] as QuestionItem[],
};
