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
        "?Ha planteado estrategias para identificar el prop?sito de la lectura con preguntas como: ?Para qu? voy a leer?, ?es relevante para lo que necesito?",
    },
    {
      id: "p02",
      numero: "02",
      group: "ANTES_LECTURA",
      texto:
        "?Ha planteado estrategias para movilizar los saberes previos de las y los estudiantes, en relaci?n al tema del texto que leer?n?",
    },
    {
      id: "p03",
      numero: "03",
      group: "ANTES_LECTURA",
      texto:
        "?Ha planteado estrategias para elaborar predicciones o lanzar hip?tesis sobre el contenido del texto, a partir de los indicios que ofrece el texto que leer?n las y los estudiantes? (?Qu? ideas tiene acerca del tema relacionado con el texto?, ?Qu? ideas ha manifestado el autor en otros de sus textos?, ?de qu? tratar? el texto?, ?por qu? crees eso?, ?Qu? piensan ustedes?)",
    },
    {
      id: "p04",
      numero: "04",
      group: "ANTES_LECTURA",
      texto:
        "?Ha planteado estrategias que motiven la lectura del texto que leer?n las y los estudiantes?",
    },

    // ---------------- DURANTE LA LECTURA (05-13) ----------------
    {
      id: "p05",
      numero: "05",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para leer el texto utilizando diversas formas de lectura, como: lectura silenciosa, en voz alta, etc.?",
    },
    {
      id: "p06",
      numero: "06",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que durante la lectura los estudiantes, despu?s de leer una parte del texto, puedan inferir o formular hip?tesis acerca de qu? continuar??",
    },
    {
      id: "p07",
      numero: "07",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias relacionadas a aclarar el texto en determinados momentos del proceso de la lectura?",
    },
    {
      id: "p08",
      numero: "08",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes, despu?s de una lectura total del texto, puedan aplicar estrategias de comprensi?n como: subrayado, sumillado, reconocimiento de ideas principales por p?rrafos, resumen, etc.?",
    },
    {
      id: "p09",
      numero: "09",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes lean dos textos (del mismo contenido o diferentes) con la finalidad de desarrollar la comparaci?n intertextual?",
    },
    {
      id: "p10",
      numero: "10",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes identifiquen si las ideas del texto le?do est?n cohesionadas?",
    },
    {
      id: "p11",
      numero: "11",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes identifiquen si las ideas del texto le?do tienen coherencia?",
    },
    {
      id: "p12",
      numero: "12",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que, en caso de realizar la lectura de dos textos (lectura intertextual) de autores diferentes, los estudiantes identifiquen ideas comunes entre ambas posturas o ideas contrarias? (?En qu? ideas coinciden? ?En qu? enfatiza m?s un autor que el otro? ?En qu? se pueden diferenciar?, etc.)",
    },
    {
      id: "p13",
      numero: "13",
      group: "DURANTE_LECTURA",
      texto:
        "?Ha planteado estrategias para que las y los estudiantes identifiquen el tipo de texto que leen?",
    },

    // ---------------- DESPU?S DE LA LECTURA (14-16) ----------------
    {
      id: "p14",
      numero: "14",
      group: "DESPUES_LECTURA",
      texto:
        "?Ha planteado preguntas que demandan la necesidad en las y los estudiantes de ubicar o localizar informaci?n en el texto, que les permita encontrar ideas principales, orden de acciones, personajes principales y secundarios e identificar p?rrafos del texto, etc.?",
    },
    {
      id: "p15",
      numero: "15",
      group: "DESPUES_LECTURA",
      texto:
        "?Ha planteado preguntas que demandan en las y los estudiantes realizar inferencias en base al contenido del texto, con la finalidad de que reconstruyan el significado del texto relacion?ndolo con sus experiencias personales y conocimientos previos; a partir de ello formulen conjeturas e hip?tesis, saquen conclusiones e interpreten?",
    },
    {
      id: "p16",
      numero: "16",
      group: "DESPUES_LECTURA",
      texto:
        "?Ha planteado preguntas que demandan en las y los estudiantes dar opiniones, reflexionar sobre el contenido o la forma, as? como asumir una posici?n sobre el contenido del texto, con la finalidad de que emitan juicios y opiniones fundamentadas y acepten o rechacen lo planteado por el autor?",
    },

    // ---------------- EVALUACI?N (17-20) ----------------
    {
      id: "p17",
      numero: "17",
      group: "EVALUACION",
      texto:
        "?Ha redactado criterios de evaluaci?n teniendo en cuenta que describen las caracter?sticas o cualidades de aquello que se quiere valorar y que las y los estudiantes deben demostrar en sus actuaciones ante una situaci?n en un contexto determinado?",
    },
    {
      id: "p18",
      numero: "18",
      group: "EVALUACION",
      texto:
        "?Ha planteado estrategias para desarrollar la retroalimentaci?n pertinente y oportuna durante el desarrollo de los procesos did?cticos de la competencia?",
    },
    {
      id: "p19",
      numero: "19",
      group: "EVALUACION",
      texto:
        "Los criterios de evaluaci?n, ?se han elaborado a partir de los est?ndares y sus desempe?os incluyendo las capacidades de la competencia que se requiere movilizar seg?n la situaci?n?",
    },
    {
      id: "p20",
      numero: "20",
      group: "EVALUACION",
      texto:
        "?Ha elaborado un instrumento de evaluaci?n que le permita determinar el nivel de logro en relaci?n a los criterios que ha planteado?",
    },
  ]] as QuestionItem[],
};
