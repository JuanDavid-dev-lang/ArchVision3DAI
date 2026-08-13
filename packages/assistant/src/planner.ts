import type { SceneDocument } from "@archvision/types";
import { buildSceneDigest, renderSceneDigest } from "./digest";
import { reviewScene, summarizeReview } from "./diagnostics";
import { matchIntent } from "./intents";
import { findKnowledge, normalize } from "./knowledge";
import { nextTutorialStep } from "./tutorial";
import type { AssistantContext, AssistantTurn } from "./types";

/**
 * Planificador local.
 *
 * Resuelve el turno sin salir del proceso. Es la ruta por defecto: responde al
 * instante, no cuesta dinero y funciona sin conexion. El modelo de lenguaje
 * entra solo cuando esto no encuentra respuesta, y produce exactamente el
 * mismo tipo de salida, de modo que el panel no distingue el origen.
 */

export interface PlanRequest {
  message: string;
  scene: SceneDocument;
  context: AssistantContext;
}

const REVIEW = /\b(revisa|revisar|analiza|analizar|comprueba|verifica|errores|problemas|fallos|esta bien|que falta)\b/;
const STATUS = /\b(resumen|estado|cuanto|cuanta|cuantos|cuantas|area|metros|superficie|que tengo|que hay|metricas|mediciones)\b/;
const GUIDE = /\b(tutorial|ensename|ensename|guia|guiame|empezar|empiezo|por donde|siguiente paso|que sigo|y ahora)\b/;
const GREETING = /^(hola|buenas|hey|que tal|buenos dias|buenas tardes|buenas noches)\b/;

/** Sugerencias que dependen de en que punto esta el proyecto. */
function defaultFollowUps(scene: SceneDocument): string[] {
  if (scene.walls.length === 0) {
    return ["Crea una habitacion de 4x3", "Como importo un plano", "Empezar el tutorial"];
  }
  if (scene.doors.length === 0) {
    return ["Anade una puerta", "Revisa el modelo", "Cuanta area tengo"];
  }
  if (scene.windows.length === 0) {
    return ["Anade una ventana", "Revisa el modelo", "Pinta los muros de ladrillo"];
  }
  return ["Revisa el modelo", "Cuanta area tengo", "Que puedo hacer ahora"];
}

/** Frase de bienvenida con el estado real del proyecto. */
export function greeting(scene: SceneDocument, context: AssistantContext): string {
  const digest = buildSceneDigest(scene, context);

  if (digest.empty) {
    return (
      `Hola. "${context.projectName}" esta vacio, asi que empezamos por el principio: ` +
      "puedo crearte una habitacion para que veas como funciona, guiarte paso a paso, " +
      "o partir de un plano que tengas escaneado. Tambien respondo preguntas sobre el editor."
    );
  }

  const m = digest.metrics;
  return (
    `Hola. En "${context.projectName}" veo ${scene.walls.length} muros, ${m.roomCount} habitacion(es) ` +
    `y ${m.usableArea.toFixed(1)} m2 de area util. Puedo modificar el modelo, revisarlo en busca de ` +
    "problemas o explicarte cualquier parte del editor. Todo lo que proponga lo apruebas tu antes de aplicarse."
  );
}

export function planLocally(request: PlanRequest): AssistantTurn {
  const { message, scene, context } = request;
  const text = normalize(message);

  if (text.trim().length === 0) {
    return {
      reply: "Dime que quieres hacer y te propongo los cambios.",
      actions: [],
      followUps: defaultFollowUps(scene),
      source: "local",
    };
  }

  // Revision del modelo: es la peticion con mas valor y la que mas se confunde
  // con una pregunta abierta, asi que se comprueba antes que nada.
  if (REVIEW.test(text)) {
    const diagnostics = reviewScene(scene);
    return {
      reply: summarizeReview(diagnostics),
      actions: [],
      diagnostics,
      followUps: defaultFollowUps(scene),
      source: "local",
    };
  }

  if (GUIDE.test(text)) {
    const next = nextTutorialStep(scene);
    if (!next) {
      return {
        reply:
          "Has completado todos los pasos del tutorial. A partir de aqui, lo util es revisar el modelo " +
          "y afinar medidas y materiales.",
        actions: [],
        followUps: defaultFollowUps(scene),
        source: "local",
      };
    }

    return {
      reply:
        `Siguiente paso de "${next.lesson.title}": ${next.step.title}. ${next.step.instruction}` +
        (next.step.why ? `\n\n${next.step.why}` : ""),
      actions: [],
      followUps: defaultFollowUps(scene),
      source: "local",
    };
  }

  if (GREETING.test(text) && text.length < 40) {
    return {
      reply: greeting(scene, context),
      actions: [],
      followUps: defaultFollowUps(scene),
      source: "local",
    };
  }

  // Las ordenes se comprueban antes que el estado: "cuantas puertas anado"
  // es rara, pero "anade una puerta de 90 cm" contiene un numero y no debe
  // acabar en el resumen de metricas.
  const intent = matchIntent({ text: message, scene, context });
  if (intent) {
    return {
      reply: intent.reply,
      actions: intent.actions,
      followUps: intent.followUps ?? defaultFollowUps(scene),
      source: "local",
    };
  }

  if (STATUS.test(text)) {
    const digest = buildSceneDigest(scene, context);
    return {
      reply: renderSceneDigest(digest),
      actions: [],
      followUps: defaultFollowUps(scene),
      source: "local",
    };
  }

  const entry = findKnowledge(message);
  if (entry) {
    return {
      reply: entry.answer,
      actions: [],
      followUps: entry.followUps ?? defaultFollowUps(scene),
      source: "local",
    };
  }

  return {
    reply:
      "No estoy seguro de haberte entendido. Puedo crear y modificar geometria (habitaciones, puertas, " +
      "ventanas, cubiertas, niveles, mobiliario), aplicar materiales, revisar el modelo en busca de " +
      "problemas y explicarte como funciona cualquier parte del editor. Dimelo con tus palabras y lo intento otra vez.",
    actions: [],
    followUps: defaultFollowUps(scene),
    source: "local",
    fallback: true,
  };
}
