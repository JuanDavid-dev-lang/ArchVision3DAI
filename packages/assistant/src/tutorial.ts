import type { SceneDocument } from "@archvision/types";

/**
 * Tutorial guiado.
 *
 * No es una secuencia de diapositivas: cada paso se da por hecho cuando el
 * documento demuestra que ocurrio. Asi el usuario avanza haciendo, y si llega
 * a un proyecto a medias los pasos ya cumplidos aparecen marcados sin tener
 * que repetirlos.
 *
 * La comprobacion mira el estado, no el evento, para que sobreviva a un
 * deshacer, a una recarga de la pagina o a un cambio de dispositivo.
 */

export interface TutorialStep {
  id: string;
  title: string;
  /** Que hacer, en imperativo y con el atajo cuando lo hay. */
  instruction: string;
  /** Por que se hace asi. Lo que convierte el tutorial en aprendizaje. */
  why?: string;
  /** Devuelve true cuando el documento demuestra que el paso esta hecho. */
  isDone: (scene: SceneDocument) => boolean;
}

export interface TutorialLesson {
  id: string;
  title: string;
  summary: string;
  steps: TutorialStep[];
}

const hasWallOnAnyFloor = (scene: SceneDocument, count: number): boolean =>
  scene.walls.length >= count;

export const TUTORIAL: TutorialLesson[] = [
  {
    id: "primeros-pasos",
    title: "Levantar el primer espacio",
    summary:
      "De un lienzo vacio a una habitacion cerrada con puerta y ventana. Diez minutos.",
    steps: [
      {
        id: "trazar-muros",
        title: "Traza cuatro muros",
        instruction:
          "Pulsa L y haz clic en las cuatro esquinas de la planta; el ultimo clic vuelve al punto de partida.",
        why:
          "Cada clic cierra un tramo y empieza el siguiente, de modo que un contorno completo se dibuja sin soltar la herramienta.",
        isDone: (scene) => hasWallOnAnyFloor(scene, 4),
      },
      {
        id: "cerrar-habitacion",
        title: "Cierra el recinto",
        instruction:
          "Junta el ultimo muro con el primero hasta que los extremos se peguen.",
        why:
          "Las habitaciones no se dibujan, se detectan: en cuanto el recorrido cierra, aparece el area calculada.",
        isDone: (scene) => scene.rooms.length >= 1,
      },
      {
        id: "colocar-puerta",
        title: "Coloca una puerta",
        instruction: "Pulsa P y haz clic sobre uno de los muros.",
        why:
          "El vano pertenece al muro, no a la escena: si mueves el muro, la puerta viaja con el.",
        isDone: (scene) => scene.doors.length >= 1,
      },
      {
        id: "colocar-ventana",
        title: "Coloca una ventana",
        instruction: "Pulsa N y haz clic sobre otro muro.",
        why:
          "El antepecho y la altura se editan despues en el inspector, en metros reales.",
        isDone: (scene) => scene.windows.length >= 1,
      },
      {
        id: "medida-exacta",
        title: "Corrige una medida",
        instruction:
          "Pulsa V, selecciona un muro y escribe su longitud exacta en el inspector.",
        why:
          "Trazar a ojo y ajustar despues es mas rapido que intentar acertar con el raton.",
        isDone: (scene) =>
          scene.walls.some((wall) => {
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.hypot(dx, dy);
            // Una longitud redonda al centimetro delata una edicion numerica.
            return Math.abs(length * 100 - Math.round(length * 100)) < 1e-6;
          }),
      },
    ],
  },
  {
    id: "materiales",
    title: "Dar acabado",
    summary: "Aplicar materiales y entender como se comportan las texturas.",
    steps: [
      {
        id: "abrir-biblioteca",
        title: "Abre la biblioteca",
        instruction: "Pulsa G o usa el boton Materiales de la barra superior.",
        why:
          "Al abrirla se carga tambien el pincel: elegir un material y pintarlo son la misma intencion.",
        isDone: (scene) =>
          scene.walls.some(
            (wall) => wall.materialInteriorId ?? wall.materialExteriorId,
          ),
      },
      {
        id: "pintar-muro",
        title: "Pinta dos superficies distintas",
        instruction:
          "Aplica un material al muro y otro distinto al suelo de la habitacion.",
        why:
          "El interior, el exterior, el suelo y el techo son caras independientes; el pincel aplica a la que senalas.",
        isDone: (scene) => {
          const wall = scene.walls.some((item) => item.materialInteriorId);
          const floor = scene.rooms.some((item) => item.floorMaterialId);
          return wall && floor;
        },
      },
    ],
  },
  {
    id: "plano",
    title: "Calcar un plano",
    summary:
      "Convertir una imagen o un plano en papel en el punto de partida del modelo.",
    steps: [
      {
        id: "subir-plano",
        title: "Sube la imagen",
        instruction: "Boton Plano, y elige un PNG o JPEG del plano.",
        isDone: (scene) => Boolean(scene.underlay),
      },
      {
        id: "fijar-escala",
        title: "Fija la escala",
        instruction:
          "Pulsa K, marca sobre el plano una medida que conozcas y escribe cuanto mide en la realidad.",
        why:
          "Es el unico dato que la imagen no puede aportar por si sola; sin el, la deteccion no distingue un muro de una linea de cota.",
        isDone: (scene) => Boolean(scene.underlay?.pixelsPerMeter),
      },
      {
        id: "aceptar-muros",
        title: "Revisa la propuesta",
        instruction:
          "Pulsa Analizar el plano y acepta solo los muros que estan bien trazados.",
        why:
          "La deteccion propone, tu decides: nada entra en el modelo sin tu revision, y todo se deshace con Ctrl+Z.",
        isDone: (scene) => scene.walls.some((wall) => wall.source === "import"),
      },
    ],
  },
  {
    id: "niveles",
    title: "Crecer en altura",
    summary: "Anadir niveles y cubierta a un modelo que ya funciona en planta.",
    steps: [
      {
        id: "crear-nivel",
        title: "Anade un nivel",
        instruction: "Pideme \"anade un nivel\" o usalo desde la barra superior.",
        isDone: (scene) => scene.floors.length >= 2,
      },
      {
        id: "escalera",
        title: "Comunica los niveles",
        instruction: "Coloca una escalera entre los dos niveles.",
        isDone: (scene) => scene.stairs.length >= 1,
      },
      {
        id: "cubierta",
        title: "Cubre el edificio",
        instruction: "Pideme una cubierta a dos aguas sobre el nivel superior.",
        why:
          "La cubierta toma su contorno de los muros del nivel, de modo que conviene dejarla para el final.",
        isDone: (scene) => scene.roofs.length >= 1,
      },
    ],
  },
];

export interface LessonProgress {
  lessonId: string;
  title: string;
  summary: string;
  done: number;
  total: number;
  steps: {
    id: string;
    title: string;
    instruction: string;
    why?: string;
    done: boolean;
  }[];
  /** Primer paso pendiente, o null si la leccion esta completa. */
  nextStepId: string | null;
}

/** Evalua el progreso de una leccion contra el documento actual. */
export function lessonProgress(
  lesson: TutorialLesson,
  scene: SceneDocument,
): LessonProgress {
  const steps = lesson.steps.map((step) => ({
    id: step.id,
    title: step.title,
    instruction: step.instruction,
    why: step.why,
    done: step.isDone(scene),
  }));

  const pending = steps.find((step) => !step.done);

  return {
    lessonId: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    done: steps.filter((step) => step.done).length,
    total: steps.length,
    steps,
    nextStepId: pending?.id ?? null,
  };
}

/** Progreso de todas las lecciones. */
export function tutorialProgress(scene: SceneDocument): LessonProgress[] {
  return TUTORIAL.map((lesson) => lessonProgress(lesson, scene));
}

/**
 * Siguiente cosa que conviene hacer.
 *
 * Recorre las lecciones en orden y devuelve el primer paso pendiente: es la
 * respuesta a "y ahora que" sin obligar a abrir el tutorial.
 */
export function nextTutorialStep(
  scene: SceneDocument,
): { lesson: TutorialLesson; step: TutorialStep } | null {
  for (const lesson of TUTORIAL) {
    for (const step of lesson.steps) {
      if (!step.isDone(scene)) return { lesson, step };
    }
  }
  return null;
}
