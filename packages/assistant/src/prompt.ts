import type { RoofKind, SceneDocument } from "@archvision/types";
import {
  buildColumn,
  buildDelete,
  buildFloor,
  buildFurniture,
  buildOpening,
  buildPaint,
  buildRename,
  buildRoof,
  buildRoom,
  buildWallHeight,
  type BuildResult,
} from "./builders";
import { reviewScene, summarizeReview } from "./diagnostics";
import { renderSceneDigest, type SceneDigest } from "./digest";
import { KNOWLEDGE } from "./knowledge";
import { nextTutorialStep } from "./tutorial";
import type { AssistantContext, Diagnostic } from "./types";

/**
 * Puente con el modelo de lenguaje.
 *
 * Las herramientas que se le ofrecen NO son los comandos de la escena: son
 * intenciones con medidas. El modelo elige la operacion y los numeros; el
 * codigo de `builders.ts` decide identificadores y coordenadas. Asi, un
 * modelo que alucine solo puede equivocarse en algo que el usuario ve escrito
 * en la propuesta antes de aceptarla.
 *
 * Los esquemas son estrictos (`additionalProperties: false` y todas las claves
 * obligatorias, con `null` para lo omitible) porque un argumento inventado
 * debe fallar en la validacion, no colarse con un valor por defecto.
 */

export interface AssistantTool {
  name: string;
  description: string;
  strict: true;
  input_schema: Record<string, unknown>;
}

const NUMBER_OR_NULL = { type: ["number", "null"] } as const;

function schema(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "crear_habitacion",
    description:
      "Crea una habitacion rectangular cerrada con cuatro muros en el nivel activo. " +
      "Usar cuando el usuario pide una habitacion, un cuarto o un rectangulo de muros. " +
      "Las medidas van en metros; usa null para aceptar el valor por defecto (3 m).",
    strict: true,
    input_schema: schema({
      ancho: { ...NUMBER_OR_NULL, description: "Ancho en metros" },
      fondo: { ...NUMBER_OR_NULL, description: "Fondo en metros" },
    }),
  },
  {
    name: "crear_vano",
    description:
      "Coloca una puerta o una ventana en el muro seleccionado; si no hay seleccion, en el muro mas " +
      "largo del nivel. Medidas en metros, null para el valor por defecto (puerta 0,90 x 2,10; ventana 1,20 x 1,10).",
    strict: true,
    input_schema: schema({
      tipo: { type: "string", enum: ["puerta", "ventana"] },
      ancho: NUMBER_OR_NULL,
      alto: NUMBER_OR_NULL,
    }),
  },
  {
    name: "aplicar_material",
    description:
      "Aplica un material a lo seleccionado, o a todos los muros del nivel si no hay seleccion. " +
      "En `material` escribe el nombre o la familia tal como la nombro el usuario (ladrillo, madera, " +
      "concreto, marmol...); el sistema busca la coincidencia en la biblioteca del proyecto.",
    strict: true,
    input_schema: schema({
      material: { type: "string", description: "Nombre o familia del material" },
      cara: { type: ["string", "null"], enum: ["interior", "exterior", null] },
    }),
  },
  {
    name: "cambiar_altura_muros",
    description:
      "Cambia la altura de los muros seleccionados, o de todos los del nivel si no hay seleccion. " +
      "Altura en metros, entre 1,5 y 12.",
    strict: true,
    input_schema: schema({ altura: { type: "number" } }),
  },
  {
    name: "crear_nivel",
    description:
      "Anade un nivel nuevo por encima del ultimo. `altura` es la altura libre en metros, o null.",
    strict: true,
    input_schema: schema({ altura: NUMBER_OR_NULL }),
  },
  {
    name: "crear_cubierta",
    description:
      "Crea una cubierta sobre el nivel activo tomando el contorno de sus muros. " +
      "Requiere al menos tres muros. `pendiente` en grados, o null.",
    strict: true,
    input_schema: schema({
      tipo: {
        type: "string",
        enum: ["plana", "un_agua", "dos_aguas", "cuatro_aguas", "mansarda"],
      },
      pendiente: NUMBER_OR_NULL,
    }),
  },
  {
    name: "crear_columna",
    description:
      "Coloca una columna en el centro de lo construido en el nivel activo. `lado` en metros, o null.",
    strict: true,
    input_schema: schema({
      redonda: { type: "boolean" },
      lado: NUMBER_OR_NULL,
    }),
  },
  {
    name: "anadir_mueble",
    description:
      "Coloca un mueble del catalogo en el centro del nivel activo. En `descripcion` escribe lo que " +
      "pidio el usuario (sofa, cama doble, mesa de comedor, nevera, escritorio...).",
    strict: true,
    input_schema: schema({ descripcion: { type: "string" } }),
  },
  {
    name: "eliminar_seleccion",
    description: "Elimina los objetos seleccionados en el editor.",
    strict: true,
    input_schema: schema({}),
  },
  {
    name: "renombrar_seleccion",
    description: "Cambia el nombre del objeto seleccionado.",
    strict: true,
    input_schema: schema({ nombre: { type: "string" } }),
  },
  {
    name: "revisar_modelo",
    description:
      "Revisa el modelo en busca de problemas: habitaciones sin acceso, vanos fuera del muro, " +
      "muros duplicados, iluminacion escasa, escaleras incomodas. Usar cuando el usuario pregunta " +
      "que falta, que esta mal, o pide una revision.",
    strict: true,
    input_schema: schema({}),
  },
];

const ROOF_BY_LABEL: Record<string, RoofKind> = {
  plana: "flat",
  un_agua: "shed",
  dos_aguas: "gable",
  cuatro_aguas: "hip",
  mansarda: "mansard",
};

export interface ToolOutcome {
  result?: BuildResult;
  diagnostics?: Diagnostic[];
  /** Texto para el turno cuando la herramienta no produce acciones. */
  reply?: string;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Ejecuta una llamada de herramienta contra los constructores.
 *
 * Devuelve null si el nombre no existe: una herramienta inventada por el
 * modelo se ignora en vez de intentar adivinar a que se referia.
 */
export function executeTool(
  name: string,
  input: Record<string, unknown>,
  scene: SceneDocument,
  context: AssistantContext,
): ToolOutcome | null {
  switch (name) {
    case "crear_habitacion":
      return {
        result: buildRoom(scene, context, {
          width: num(input.ancho),
          depth: num(input.fondo),
        }),
      };

    case "crear_vano":
      return {
        result: buildOpening(scene, context, {
          kind: str(input.tipo) === "ventana" ? "window" : "door",
          width: num(input.ancho),
          height: num(input.alto),
        }),
      };

    case "aplicar_material": {
      const face = str(input.cara);
      return {
        result: buildPaint(scene, context, {
          material: str(input.material),
          face: face === "interior" || face === "exterior" ? face : undefined,
        }),
      };
    }

    case "cambiar_altura_muros": {
      const height = num(input.altura);
      if (height === undefined) return { reply: "Necesito la altura en metros." };
      return { result: buildWallHeight(scene, context, { height }) };
    }

    case "crear_nivel":
      return { result: buildFloor({ height: num(input.altura) }) };

    case "crear_cubierta":
      return {
        result: buildRoof(scene, context, {
          kind: ROOF_BY_LABEL[str(input.tipo)] ?? "gable",
          slopeDeg: num(input.pendiente),
        }),
      };

    case "crear_columna":
      return {
        result: buildColumn(scene, context, {
          round: input.redonda === true,
          side: num(input.lado),
        }),
      };

    case "anadir_mueble":
      return {
        result: buildFurniture(scene, context, { query: str(input.descripcion) }),
      };

    case "eliminar_seleccion":
      return { result: buildDelete(context) };

    case "renombrar_seleccion":
      return { result: buildRename(context, { name: str(input.nombre) }) };

    case "revisar_modelo": {
      const diagnostics = reviewScene(scene);
      return { diagnostics, reply: summarizeReview(diagnostics) };
    }

    default:
      return null;
  }
}

/**
 * Prompt de sistema.
 *
 * Incluye la ficha del proyecto porque el asistente debe hablar del modelo que
 * el usuario tiene delante, no de arquitectura en abstracto; y la lista de
 * limitaciones porque prometer una exportacion que no existe cuesta mas
 * confianza que reconocerlo.
 */
export function buildSystemPrompt(
  digest: SceneDigest,
  scene: SceneDocument,
): string {
  const next = nextTutorialStep(scene);
  const topics = KNOWLEDGE.map((entry) => entry.title).join(", ");

  return [
    "Eres el asistente de ArchVision 3D AI, un editor web de modelos 3D de vivienda.",
    "Ayudas a modelar y ademas ensenas a usar el editor. Respondes en el idioma del usuario,",
    "por defecto espanol, con frases directas y sin adornos.",
    "",
    "Como trabajas:",
    "- Para modificar el modelo, llama a una herramienta. Nunca describas un cambio como hecho:",
    "  las herramientas producen propuestas que la persona acepta o rechaza en el panel.",
    "- Una sola herramienta por peticion, salvo que el usuario pida varias cosas distintas.",
    "- Si la peticion es ambigua en algo que cambia el resultado, pregunta antes de proponer.",
    "- Si te preguntan como se hace algo, explicalo con el atajo de teclado y el porque.",
    "- Las medidas son siempre metros. Redondea a dos decimales al hablar.",
    "",
    "Lo que la aplicacion NO tiene todavia: exportacion a GLB, OBJ o PDF; render fotorrealista;",
    "estudio solar; edicion simultanea entre varias personas; rasterizado de PDF importados.",
    "Si te piden algo de eso, dilo claramente en vez de improvisar una alternativa.",
    "",
    "No eres arquitecto colegiado y el modelo no es un calculo estructural ni un tramite:",
    "cuando des una medida con consecuencias legales, recomienda verificar la norma local.",
    "",
    `Temas del editor que conoces: ${topics}.`,
    "",
    "Estado actual del proyecto:",
    renderSceneDigest(digest),
    next
      ? `\nSiguiente paso pendiente del tutorial: ${next.lesson.title} / ${next.step.title}.`
      : "\nEl usuario ha completado el tutorial guiado.",
  ].join("\n");
}
