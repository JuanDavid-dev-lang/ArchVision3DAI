import type {
  MaterialDefinition,
  RoofKind,
  SceneCommand,
  SceneDocument,
  Vector2,
  Wall,
} from "@archvision/types";
import { FURNITURE_CATALOG, distance2 } from "@archvision/shared";
import type { AssistantContext, ProposedAction } from "./types";
import { normalize } from "./knowledge";

/**
 * Construccion de propuestas.
 *
 * Aqui vive TODA la decision geometrica: donde cae una habitacion nueva, en
 * que muro entra una puerta, a que entidades alcanza un material. Ni el
 * analisis del texto ni el modelo de lenguaje deciden nada de esto; ambos se
 * limitan a elegir la operacion y sus medidas.
 *
 * El motivo es concreto: un modelo de lenguaje inventa coordenadas e
 * identificadores con toda naturalidad. Si nunca los produce, no puede
 * equivocarse en ellos, y lo unico que hay que validar son numeros con
 * significado que el usuario puede leer antes de aceptar.
 */

export interface BuildResult {
  reply: string;
  actions: ProposedAction[];
  followUps?: string[];
}

/** Medidas por defecto, en metros. */
export const DEFAULTS = {
  wallThickness: 0.15,
  doorWidth: 0.9,
  doorHeight: 2.1,
  windowWidth: 1.2,
  windowHeight: 1.1,
  windowSill: 0.9,
  roomSide: 3,
  /** Separacion entre lo que ya existe y lo que se crea. */
  gap: 1,
} as const;

let counter = 0;
function actionId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function activeFloorId(
  scene: SceneDocument,
  context: AssistantContext,
): string | null {
  return (
    context.activeFloorId ??
    scene.activeFloorId ??
    scene.floors[0]?.id ??
    null
  );
}

export function wallsOfFloor(scene: SceneDocument, floorId: string): Wall[] {
  return scene.walls.filter((wall) => wall.floorId === floorId);
}

/**
 * Punto libre donde colocar algo nuevo.
 *
 * A la derecha de lo ya construido: superponer geometria es mas dificil de
 * corregir visualmente que arrastrar una pieza que se ve entera.
 */
export function freeSpot(scene: SceneDocument, floorId: string): Vector2 {
  const walls = wallsOfFloor(scene, floorId);
  if (walls.length === 0) return { x: 0, y: 0 };

  let maxX = -Infinity;
  let minY = Infinity;
  for (const wall of walls) {
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
  }

  return { x: maxX + DEFAULTS.gap, y: minY };
}

/** Centro aproximado de lo construido en el nivel. */
export function centerOfFloor(scene: SceneDocument, floorId: string): Vector2 {
  const walls = wallsOfFloor(scene, floorId);
  if (walls.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const wall of walls) {
    sumX += (wall.start.x + wall.end.x) / 2;
    sumY += (wall.start.y + wall.end.y) / 2;
  }

  return { x: sumX / walls.length, y: sumY / walls.length };
}

/** Muro sobre el que actuar: el seleccionado, o el mas largo del nivel. */
export function targetWall(
  scene: SceneDocument,
  context: AssistantContext,
): { wall: Wall; fromSelection: boolean } | null {
  const selected = scene.walls.find((wall) =>
    context.selection.includes(wall.id),
  );
  if (selected) return { wall: selected, fromSelection: true };

  const floorId = activeFloorId(scene, context);
  if (!floorId) return null;

  const walls = wallsOfFloor(scene, floorId);
  const longest = walls.reduce<Wall | null>((best, wall) => {
    if (!best) return wall;
    return distance2(wall.start, wall.end) > distance2(best.start, best.end)
      ? wall
      : best;
  }, null);

  return longest ? { wall: longest, fromSelection: false } : null;
}

/** Sinonimos corrientes que no aparecen en el nombre del material. */
const MATERIAL_HINTS: Record<string, string[]> = {
  mat_brick_red: ["ladrillo", "obra vista"],
  mat_wood_oak: ["madera", "roble"],
  mat_wood_parquet: ["parquet", "duela"],
  mat_concrete: ["concreto", "hormigon", "cemento"],
  mat_plaster_white: ["yeso", "blanco"],
  mat_stone_slate: ["piedra", "pizarra"],
  mat_ceramic_white: ["ceramica", "baldosa", "azulejo"],
  mat_marble_carrara: ["marmol"],
  mat_glass_clear: ["vidrio", "cristal"],
  mat_grass: ["cesped", "pasto", "jardin"],
  mat_roof_tile: ["teja", "barro"],
  mat_metal_dark: ["metal", "acero"],
};

/** Busca el material que mejor encaja con un texto libre. */
export function matchMaterial(
  materials: readonly MaterialDefinition[],
  query: string,
): MaterialDefinition | null {
  const text = normalize(query);
  let best: { material: MaterialDefinition; score: number } | null = null;

  for (const material of materials) {
    let score = 0;

    for (const word of normalize(material.name).split(/\s+/)) {
      if (word.length >= 4 && text.includes(word)) score += word.length;
    }
    for (const hint of MATERIAL_HINTS[material.id] ?? []) {
      if (text.includes(hint)) score += hint.length + 2;
    }

    if (score === 0) continue;
    if (!best || score > best.score) best = { material, score };
  }

  return best?.material ?? null;
}

/** Busca el mueble que mejor encaja con un texto libre. */
export function matchFurniture(
  query: string,
): (typeof FURNITURE_CATALOG)[number] | null {
  const text = normalize(query);
  let best: { item: (typeof FURNITURE_CATALOG)[number]; score: number } | null =
    null;

  for (const item of FURNITURE_CATALOG) {
    let score = 0;
    for (const word of normalize(item.name).split(/\s+/)) {
      if (word.length >= 4 && text.includes(word)) score += word.length;
    }
    if (score === 0) continue;
    if (!best || score > best.score) best = { item, score };
  }

  return best?.item ?? null;
}

const NO_FLOOR: BuildResult = {
  reply:
    "No hay ningun nivel en el proyecto, y todo objeto pertenece a uno. Pideme primero que anada un nivel.",
  actions: [],
  followUps: ["Anade un nivel"],
};

// --------------------------------------------------------------------------
// Constructores
// --------------------------------------------------------------------------

export function buildRoom(
  scene: SceneDocument,
  context: AssistantContext,
  params: { width?: number; depth?: number },
): BuildResult {
  const floorId = activeFloorId(scene, context);
  if (!floorId) return NO_FLOOR;

  const width = params.width ?? DEFAULTS.roomSide;
  const depth = params.depth ?? width;

  if (!(width >= 0.5 && width <= 100 && depth >= 0.5 && depth <= 100)) {
    return {
      reply:
        `Esas medidas (${width.toFixed(2)} x ${depth.toFixed(2)} m) no parecen las de una habitacion. ` +
        'Dime el ancho y el fondo en metros, por ejemplo "crea una habitacion de 4x3".',
      actions: [],
    };
  }

  const origin = freeSpot(scene, floorId);
  const corners: Vector2[] = [
    { x: origin.x, y: origin.y },
    { x: origin.x + width, y: origin.y },
    { x: origin.x + width, y: origin.y + depth },
    { x: origin.x, y: origin.y + depth },
  ];

  const commands: SceneCommand[] = corners.map((corner, index) => ({
    type: "CREATE_WALL",
    origin: "ai",
    floorId,
    start: corner,
    // El ultimo tramo vuelve al primer punto: eso es lo que cierra el recinto
    // y hace que la deteccion de habitaciones calcule su area.
    end: corners[(index + 1) % corners.length] ?? corner,
    thickness: DEFAULTS.wallThickness,
  }));

  const area = width * depth;

  return {
    reply:
      `Propongo una habitacion de ${width.toFixed(2)} x ${depth.toFixed(2)} m (${area.toFixed(2)} m2 medidos por el eje de los muros), ` +
      `con muros de ${(DEFAULTS.wallThickness * 100).toFixed(0)} cm. La coloco junto a lo que ya hay para que no se solape.`,
    actions: [
      {
        id: actionId("room"),
        title: `Habitacion de ${width.toFixed(2)} x ${depth.toFixed(2)} m`,
        summary: `Cuatro muros cerrados en el nivel activo, ${area.toFixed(2)} m2`,
        commands,
        confidence: 0.9,
      },
    ],
    followUps: ["Anade una puerta", "Anade una ventana"],
  };
}

export function buildOpening(
  scene: SceneDocument,
  context: AssistantContext,
  params: { kind: "door" | "window"; width?: number; height?: number },
): BuildResult {
  const target = targetWall(scene, context);
  if (!target) {
    return {
      reply:
        "Todavia no hay muros donde colocar el hueco. Traza primero el contorno, o pideme una habitacion.",
      actions: [],
      followUps: ["Crea una habitacion de 4x3"],
    };
  }

  const { wall, fromSelection } = target;
  const length = distance2(wall.start, wall.end);
  const isDoor = params.kind === "door";

  const width = params.width ?? (isDoor ? DEFAULTS.doorWidth : DEFAULTS.windowWidth);
  const height = params.height ?? (isDoor ? DEFAULTS.doorHeight : DEFAULTS.windowHeight);

  if (width >= length) {
    return {
      reply:
        `El hueco (${width.toFixed(2)} m) no cabe en el muro elegido, que mide ${length.toFixed(2)} m. ` +
        "Selecciona otro muro o reduce el ancho.",
      actions: [],
    };
  }

  const command: SceneCommand = isDoor
    ? {
        type: "CREATE_DOOR",
        origin: "ai",
        wallId: wall.id,
        offset: length / 2,
        width,
        height,
      }
    : {
        type: "CREATE_WINDOW",
        origin: "ai",
        wallId: wall.id,
        offset: length / 2,
        width,
        height,
        sillHeight: DEFAULTS.windowSill,
      };

  const label = isDoor ? "puerta" : "ventana";
  const chosen = fromSelection ? "el muro seleccionado" : "el muro mas largo del nivel";

  return {
    reply:
      `Coloco una ${label} de ${width.toFixed(2)} x ${height.toFixed(2)} m en el centro de ${chosen} ` +
      `("${wall.name}", ${length.toFixed(2)} m).` +
      (fromSelection ? "" : " Si querias otro muro, seleccionalo y repite la peticion."),
    actions: [
      {
        id: actionId(label),
        title: `${isDoor ? "Puerta" : "Ventana"} de ${width.toFixed(2)} x ${height.toFixed(2)} m`,
        summary: `En "${wall.name}", a ${(length / 2).toFixed(2)} m del inicio`,
        commands: [command],
        confidence: fromSelection ? 0.9 : 0.6,
      },
    ],
  };
}

export function buildPaint(
  scene: SceneDocument,
  context: AssistantContext,
  params: { material: string; face?: "interior" | "exterior" },
): BuildResult {
  const material = matchMaterial(scene.materials, params.material);
  if (!material) {
    return {
      reply:
        `No encuentro un material que se parezca a "${params.material}". Abre la biblioteca con la tecla G ` +
        "para ver los disponibles, o dime la categoria: ladrillo, madera, concreto, piedra, ceramica, marmol, vidrio.",
      actions: [],
    };
  }

  const floorId = activeFloorId(scene, context);
  const selection = context.selection;
  const targets =
    selection.length > 0
      ? [...selection]
      : floorId
        ? wallsOfFloor(scene, floorId).map((wall) => wall.id)
        : [];

  if (targets.length === 0) {
    return {
      reply: `Tengo "${material.name}" listo, pero no hay nada a lo que aplicarlo. Selecciona un objeto o traza algun muro.`,
      actions: [],
    };
  }

  const scope =
    selection.length > 0
      ? `${selection.length} objeto(s) seleccionados`
      : `los ${targets.length} muros del nivel`;

  return {
    reply:
      `Aplico "${material.name}" a ${scope}` +
      (params.face ? ` por la cara ${params.face}.` : ".") +
      (selection.length === 0
        ? " Si solo querias uno, seleccionalo antes y te lo aplico solo a ese."
        : ""),
    actions: [
      {
        id: actionId("paint"),
        title: `Aplicar ${material.name}`,
        summary: `${scope}${params.face ? `, cara ${params.face}` : ""}`,
        commands: [
          {
            type: "ASSIGN_MATERIAL",
            origin: "ai",
            targetIds: targets,
            materialId: material.id,
            ...(params.face ? { face: params.face } : {}),
          },
        ],
        confidence: selection.length > 0 ? 0.9 : 0.6,
      },
    ],
  };
}

export function buildWallHeight(
  scene: SceneDocument,
  context: AssistantContext,
  params: { height: number },
): BuildResult {
  const height = params.height;
  if (!(height >= 1.5 && height <= 12)) {
    return {
      reply:
        'Dime a que altura quieres los muros, en metros. Por ejemplo: "sube la altura a 2,70".',
      actions: [],
    };
  }

  const floorId = activeFloorId(scene, context);
  if (!floorId) return NO_FLOOR;

  const selection = context.selection;
  const walls = wallsOfFloor(scene, floorId).filter(
    (wall) => selection.length === 0 || selection.includes(wall.id),
  );

  if (walls.length === 0) {
    return { reply: "No hay muros en el nivel activo.", actions: [] };
  }

  return {
    reply:
      `Llevo ${walls.length} muro(s) a ${height.toFixed(2)} m de altura. ` +
      "La altura libre del nivel se define aparte: esto cambia los muros, no el nivel.",
    actions: [
      {
        id: actionId("height"),
        title: `Altura de muros a ${height.toFixed(2)} m`,
        summary: `${walls.length} muro(s) del nivel activo`,
        commands: walls.map((wall) => ({
          type: "UPDATE_WALL" as const,
          origin: "ai" as const,
          wallId: wall.id,
          patch: { height },
        })),
        confidence: 0.85,
      },
    ],
  };
}

export function buildFloor(params: { height?: number }): BuildResult {
  const height =
    params.height !== undefined && params.height >= 2 && params.height <= 6
      ? params.height
      : undefined;

  return {
    reply:
      "Anado un nivel nuevo por encima del ultimo" +
      (height ? `, con ${height.toFixed(2)} m de altura libre.` : ".") +
      " Lo que dibujes despues ira a ese nivel mientras siga activo.",
    actions: [
      {
        id: actionId("floor"),
        title: "Nuevo nivel",
        summary: height
          ? `Altura libre ${height.toFixed(2)} m`
          : "Altura libre por defecto",
        commands: [
          { type: "CREATE_FLOOR", origin: "ai", ...(height ? { height } : {}) },
        ],
        confidence: 0.9,
      },
    ],
    followUps: ["Crea una habitacion de 4x3", "Anade una cubierta a dos aguas"],
  };
}

const ROOF_LABELS: Record<RoofKind, string> = {
  flat: "plana",
  shed: "a un agua",
  gable: "a dos aguas",
  hip: "a cuatro aguas",
  mansard: "mansarda",
  custom: "personalizada",
};

export function buildRoof(
  scene: SceneDocument,
  context: AssistantContext,
  params: { kind: RoofKind; slopeDeg?: number },
): BuildResult {
  const floorId = activeFloorId(scene, context);
  if (!floorId) return NO_FLOOR;

  if (wallsOfFloor(scene, floorId).length < 3) {
    return {
      reply:
        "La cubierta toma su contorno de los muros del nivel, y aqui todavia no hay suficientes. " +
        "Levanta primero el perimetro.",
      actions: [],
      followUps: ["Crea una habitacion de 4x3"],
    };
  }

  const slope =
    params.slopeDeg !== undefined && params.slopeDeg >= 5 && params.slopeDeg <= 60
      ? params.slopeDeg
      : undefined;
  const label = ROOF_LABELS[params.kind];

  return {
    reply:
      `Propongo una cubierta ${label} sobre el nivel activo, tomando el contorno de sus muros` +
      (slope ? ` con ${slope.toFixed(0)} grados de pendiente.` : "."),
    actions: [
      {
        id: actionId("roof"),
        title: `Cubierta ${label}`,
        summary: slope ? `Pendiente ${slope.toFixed(0)} grados` : "Pendiente por defecto",
        commands: [
          {
            type: "CREATE_ROOF",
            origin: "ai",
            floorId,
            kind: params.kind,
            ...(slope ? { slopeDeg: slope } : {}),
          },
        ],
        confidence: 0.85,
      },
    ],
  };
}

export function buildColumn(
  scene: SceneDocument,
  context: AssistantContext,
  params: { round?: boolean; side?: number },
): BuildResult {
  const floorId = activeFloorId(scene, context);
  if (!floorId) return NO_FLOOR;

  const position = centerOfFloor(scene, floorId);
  const side =
    params.side !== undefined && params.side >= 0.1 && params.side <= 2
      ? params.side
      : undefined;

  return {
    reply:
      `Coloco una columna ${params.round ? "circular" : "rectangular"} en el centro de lo construido` +
      (side ? ` de ${(side * 100).toFixed(0)} cm de lado.` : ".") +
      " Arrastrala despues a su sitio exacto.",
    actions: [
      {
        id: actionId("column"),
        title: "Columna",
        summary: `En (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`,
        commands: [
          {
            type: "CREATE_COLUMN",
            origin: "ai",
            floorId,
            position,
            shape: params.round ? "circle" : "rect",
            ...(side ? { width: side, depth: side } : {}),
          },
        ],
        confidence: 0.7,
      },
    ],
  };
}

export function buildFurniture(
  scene: SceneDocument,
  context: AssistantContext,
  params: { query: string },
): BuildResult {
  const item = matchFurniture(params.query);
  if (!item) {
    return {
      reply:
        `No tengo nada parecido a "${params.query}" en la biblioteca. Hay sofas, camas, mesas, sillas, ` +
        "cocina, bano, closet, escritorio y algo de decoracion.",
      actions: [],
    };
  }

  const floorId = activeFloorId(scene, context);
  if (!floorId) return NO_FLOOR;

  const center = centerOfFloor(scene, floorId);

  return {
    reply:
      `Coloco "${item.name}" (${item.size.x.toFixed(2)} x ${item.size.z.toFixed(2)} m en planta) en el centro del nivel. ` +
      "Es un volumen para comprobar que el espacio funciona, no un modelo de catalogo.",
    actions: [
      {
        id: actionId("furniture"),
        title: item.name,
        summary: `${item.size.x.toFixed(2)} x ${item.size.z.toFixed(2)} m en el nivel activo`,
        commands: [
          {
            type: "ADD_FURNITURE",
            origin: "ai",
            floorId,
            catalogId: item.id,
            position: { x: center.x, y: 0, z: center.y },
          },
        ],
        confidence: 0.8,
      },
    ],
  };
}

export function buildDelete(context: AssistantContext): BuildResult {
  if (context.selection.length === 0) {
    return {
      reply:
        "No hay nada seleccionado. Selecciona en el visor o en el arbol de la derecha lo que quieres quitar " +
        "y repite la peticion.",
      actions: [],
    };
  }

  return {
    reply: `Elimino ${context.selection.length} objeto(s) seleccionados. Se recupera con Ctrl+Z.`,
    actions: [
      {
        id: actionId("delete"),
        title: `Eliminar ${context.selection.length} objeto(s)`,
        summary: "Los objetos seleccionados en el editor",
        commands: [
          { type: "DELETE_OBJECTS", origin: "ai", ids: [...context.selection] },
        ],
        confidence: 0.9,
      },
    ],
  };
}

export function buildRename(
  context: AssistantContext,
  params: { name: string },
): BuildResult {
  const id = context.selection[0];
  if (!id) {
    return {
      reply: "Selecciona primero el objeto que quieres renombrar.",
      actions: [],
    };
  }

  const name = params.name.trim();
  if (name.length === 0) {
    return { reply: "Dime con que nombre lo dejo.", actions: [] };
  }

  return {
    reply: `Renombro el objeto seleccionado a "${name}".`,
    actions: [
      {
        id: actionId("rename"),
        title: `Renombrar a "${name}"`,
        summary: "Objeto seleccionado",
        commands: [{ type: "RENAME_OBJECT", origin: "ai", id, name }],
        confidence: 0.8,
      },
    ],
  };
}
