import type { EntityId, SceneCommand } from "@archvision/types";

/**
 * Contratos del asistente.
 *
 * Regla que gobierna todo el paquete: el asistente NUNCA muta la escena. Su
 * salida es una propuesta de comandos que el editor valida y aplica solo si la
 * persona la acepta. Ningun modulo de aqui importa Three.js, el DOM ni Prisma.
 */

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  text: string;
  /** Marca de tiempo en milisegundos; la pone quien crea el mensaje. */
  at: number;
}

/** Gravedad de un hallazgo de la revision del modelo. */
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  /** Identificador de la regla, estable entre ejecuciones. */
  rule: string;
  severity: DiagnosticSeverity;
  title: string;
  /** Explicacion en lenguaje llano, con la medida concreta cuando existe. */
  detail: string;
  /** Entidades implicadas, para poder seleccionarlas desde el panel. */
  entityIds: EntityId[];
  /** Correccion propuesta. Ausente cuando la decision es del usuario. */
  fix?: {
    label: string;
    commands: SceneCommand[];
  };
}

/**
 * Accion propuesta por el asistente.
 *
 * Se agrupa por intencion (no por comando) para que el usuario acepte o
 * rechace una operacion completa: "crear una habitacion de 4x3" son cuatro
 * comandos y una sola decision.
 */
export interface ProposedAction {
  id: string;
  title: string;
  /** Que va a cambiar, en una frase. */
  summary: string;
  commands: SceneCommand[];
  /** 0..1. Por debajo de 0.5 el panel pide confirmacion explicita. */
  confidence: number;
}

/** Respuesta completa a un mensaje del usuario. */
export interface AssistantTurn {
  reply: string;
  actions: ProposedAction[];
  /** Hallazgos, cuando la peticion era una revision del modelo. */
  diagnostics?: Diagnostic[];
  /** Siguientes pasos sugeridos, para rellenar el cuadro de sugerencias. */
  followUps: string[];
  /** Quien resolvio el turno: el motor local o el modelo de lenguaje. */
  source: "local" | "model";
  /**
   * true cuando el motor local no reconocio la peticion. Es la senal para
   * intentar con el modelo de lenguaje; sin ella habria que adivinar mirando
   * si el turno trae acciones, y una pregunta bien respondida tampoco las trae.
   */
  fallback?: boolean;
}

/** Contexto que acompana a cada peticion. */
export interface AssistantContext {
  projectName: string;
  /** Ids seleccionados en el editor. */
  selection: EntityId[];
  activeFloorId: EntityId | null;
  /** Herramienta activa, util para responder "como uso esto". */
  tool?: string;
  /** Unidad de visualizacion preferida. */
  displayUnit?: string;
}
