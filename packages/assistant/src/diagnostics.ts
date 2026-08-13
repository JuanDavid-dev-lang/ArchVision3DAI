import type { SceneDocument, Wall } from "@archvision/types";
import { distance2 } from "@archvision/shared";
import type { Diagnostic } from "./types";

/**
 * Revision del modelo.
 *
 * Cada regla comprueba una sola cosa y explica la medida que la dispara, para
 * que el usuario pueda discutirla. Los umbrales son valores de uso corriente
 * en vivienda, NO una norma: la plataforma no certifica nada y el texto lo
 * dice cuando el dato tiene consecuencias legales.
 *
 * El orden de la lista es el orden de aparicion en el panel: primero lo que
 * impide que el modelo sea coherente, despues lo que afecta al habitar.
 */

/** Tolerancia para considerar que dos extremos de muro son el mismo punto. */
const JOINT_TOLERANCE = 0.05;
/** Muro tan corto que casi siempre es un clic accidental. */
const MIN_WALL_LENGTH = 0.2;
/** Ancho de paso minimo habitual en vivienda. */
const MIN_DOOR_WIDTH = 0.7;
/** Altura de paso minima habitual. */
const MIN_DOOR_HEIGHT = 1.9;
/** Altura libre por debajo de la cual conviene revisar la norma local. */
const LOW_CEILING = 2.2;
/** Proporcion de ventana respecto al area de suelo que se considera escasa. */
const MIN_GLAZING_RATIO = 0.1;
/** Contrahuella y huella comodas en escalera domestica. */
const MAX_RISER = 0.19;
const MIN_TREAD = 0.25;
/** Limite de muros por encima del cual se omiten las reglas cuadraticas. */
const PAIRWISE_LIMIT = 1500;

function wallLength(wall: Wall): number {
  return distance2(wall.start, wall.end);
}

function samePoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return Math.abs(a.x - b.x) <= JOINT_TOLERANCE && Math.abs(a.y - b.y) <= JOINT_TOLERANCE;
}

/** Muros minusculos: casi siempre sobran. */
function checkTinyWalls(scene: SceneDocument): Diagnostic[] {
  const tiny = scene.walls.filter((wall) => wallLength(wall) < MIN_WALL_LENGTH);
  if (tiny.length === 0) return [];

  return [
    {
      rule: "wall-tiny",
      severity: "warning",
      title: `${tiny.length} muro(s) de longitud casi nula`,
      detail:
        `Miden menos de ${(MIN_WALL_LENGTH * 100).toFixed(0)} cm. Suelen aparecer al hacer doble clic ` +
        "mientras se traza y no se ven en el modelo, pero cuentan en las mediciones.",
      entityIds: tiny.map((wall) => wall.id),
      fix: {
        label: "Eliminarlos",
        commands: [
          { type: "DELETE_OBJECTS", origin: "ai", ids: tiny.map((w) => w.id) },
        ],
      },
    },
  ];
}

/** Muros repetidos exactamente sobre otro. */
function checkDuplicateWalls(scene: SceneDocument): Diagnostic[] {
  if (scene.walls.length > PAIRWISE_LIMIT) return [];

  const duplicates: string[] = [];
  for (let i = 0; i < scene.walls.length; i += 1) {
    const a = scene.walls[i];
    if (!a) continue;
    for (let j = i + 1; j < scene.walls.length; j += 1) {
      const b = scene.walls[j];
      if (!b || a.floorId !== b.floorId) continue;
      const same =
        (samePoint(a.start, b.start) && samePoint(a.end, b.end)) ||
        (samePoint(a.start, b.end) && samePoint(a.end, b.start));
      if (same) duplicates.push(b.id);
    }
  }

  if (duplicates.length === 0) return [];
  const unique = Array.from(new Set(duplicates));

  return [
    {
      rule: "wall-duplicate",
      severity: "warning",
      title: `${unique.length} muro(s) duplicados`,
      detail:
        "Hay muros trazados encima de otros con el mismo recorrido. Duplican la superficie " +
        "de acabados en las mediciones y provocan parpadeo en el visor 3D.",
      entityIds: unique,
      fix: {
        label: "Eliminar los repetidos",
        commands: [{ type: "DELETE_OBJECTS", origin: "ai", ids: unique }],
      },
    },
  ];
}

/** Extremos de muro que no llegan a ningun otro muro. */
function checkOpenCorners(scene: SceneDocument): Diagnostic[] {
  if (scene.walls.length === 0 || scene.walls.length > PAIRWISE_LIMIT) return [];

  const loose: string[] = [];
  for (const wall of scene.walls) {
    const others = scene.walls.filter(
      (other) => other.id !== wall.id && other.floorId === wall.floorId,
    );
    for (const point of [wall.start, wall.end]) {
      const touches = others.some(
        (other) => samePoint(other.start, point) || samePoint(other.end, point),
      );
      if (!touches && !loose.includes(wall.id)) loose.push(wall.id);
    }
  }

  if (loose.length === 0) return [];

  return [
    {
      rule: "wall-open-end",
      severity: "info",
      title: `${loose.length} muro(s) con un extremo suelto`,
      detail:
        "Un extremo no toca ningun otro muro. Es normal en un tabique o una fachada libre, " +
        "pero si esperabas una habitacion cerrada, el area no se calculara hasta unirlos. " +
        "Con el ajuste a cuadricula activo, los extremos se pegan al acercarlos.",
      entityIds: loose,
    },
  ];
}

/** Habitaciones sin acceso. */
function checkRoomAccess(scene: SceneDocument): Diagnostic[] {
  const blind = scene.rooms.filter((room) => {
    const ids = new Set(room.wallIds);
    const hasDoor = scene.doors.some((door) => ids.has(door.wallId));
    const hasOpening = scene.openings.some((item) => ids.has(item.wallId));
    return !hasDoor && !hasOpening;
  });

  if (blind.length === 0) return [];

  return [
    {
      rule: "room-no-access",
      severity: "warning",
      title: `${blind.length} habitacion(es) sin acceso`,
      detail:
        `Ningun muro de ${blind.map((room) => `"${room.name}"`).join(", ")} tiene puerta ni vano. ` +
        "Coloca una puerta con la tecla P sobre el muro que la comunica.",
      entityIds: blind.map((room) => room.id),
    },
  ];
}

/** Iluminacion natural escasa. */
function checkDaylight(scene: SceneDocument): Diagnostic[] {
  const findings: Diagnostic[] = [];

  for (const room of scene.rooms) {
    if (room.area <= 0) continue;
    const ids = new Set(room.wallIds);
    const glazing = scene.windows
      .filter((window) => ids.has(window.wallId))
      .reduce((total, window) => total + window.width * window.height, 0);

    const ratio = glazing / room.area;
    if (ratio >= MIN_GLAZING_RATIO) continue;

    findings.push({
      rule: "room-daylight",
      severity: glazing === 0 ? "warning" : "info",
      title:
        glazing === 0
          ? `"${room.name}" no tiene ventanas`
          : `"${room.name}" con poca ventana`,
      detail:
        `Superficie de ventana ${glazing.toFixed(2)} m2 frente a ${room.area.toFixed(1)} m2 de suelo ` +
        `(${(ratio * 100).toFixed(0)} %). Como referencia se suele buscar al menos un ${(MIN_GLAZING_RATIO * 100).toFixed(0)} % ` +
        "en piezas habitables. Consulta la norma que aplique en tu municipio.",
      entityIds: [room.id],
    });
  }

  return findings;
}

/** Vanos incomodos o imposibles. */
function checkOpenings(scene: SceneDocument): Diagnostic[] {
  const findings: Diagnostic[] = [];
  const byWall = new Map(scene.walls.map((wall) => [wall.id, wall]));

  const narrow = scene.doors.filter((door) => door.width < MIN_DOOR_WIDTH);
  if (narrow.length > 0) {
    findings.push({
      rule: "door-narrow",
      severity: "warning",
      title: `${narrow.length} puerta(s) demasiado estrechas`,
      detail:
        `Miden menos de ${(MIN_DOOR_WIDTH * 100).toFixed(0)} cm de ancho. Por debajo de esa medida no pasa ` +
        "un mueble corriente ni una silla de ruedas.",
      entityIds: narrow.map((door) => door.id),
      fix: {
        label: "Llevarlas a 80 cm",
        commands: narrow.map((door) => ({
          type: "UPDATE_OPENING" as const,
          origin: "ai" as const,
          openingId: door.id,
          kindOf: "door" as const,
          patch: { width: 0.8 },
        })),
      },
    });
  }

  const low = scene.doors.filter((door) => door.height < MIN_DOOR_HEIGHT);
  if (low.length > 0) {
    findings.push({
      rule: "door-low",
      severity: "info",
      title: `${low.length} puerta(s) de poca altura`,
      detail: `Miden menos de ${MIN_DOOR_HEIGHT.toFixed(2)} m. La altura corriente de paso es 2,00 a 2,10 m.`,
      entityIds: low.map((door) => door.id),
    });
  }

  /** Un vano que se sale del muro no se puede construir. */
  const overflow: string[] = [];
  const all = [
    ...scene.doors.map((d) => ({ id: d.id, wallId: d.wallId, offset: d.offset, width: d.width })),
    ...scene.windows.map((w) => ({ id: w.id, wallId: w.wallId, offset: w.offset, width: w.width })),
    ...scene.openings.map((o) => ({ id: o.id, wallId: o.wallId, offset: o.offset, width: o.width })),
  ];

  for (const item of all) {
    const wall = byWall.get(item.wallId);
    if (!wall) continue;
    const length = wallLength(wall);
    if (item.offset - item.width / 2 < -1e-6 || item.offset + item.width / 2 > length + 1e-6) {
      overflow.push(item.id);
    }
  }

  if (overflow.length > 0) {
    findings.push({
      rule: "opening-overflow",
      severity: "error",
      title: `${overflow.length} vano(s) fuera del muro`,
      detail:
        "El hueco sobresale del muro que lo contiene. Suele ocurrir al acortar un muro que ya " +
        "tenia una puerta o una ventana colocada.",
      entityIds: overflow,
    });
  }

  return findings;
}

/** Altura libre baja. */
function checkCeilingHeight(scene: SceneDocument): Diagnostic[] {
  const low = scene.floors.filter((floor) => floor.height < LOW_CEILING);
  if (low.length === 0) return [];

  return [
    {
      rule: "floor-low-ceiling",
      severity: "info",
      title: `${low.length} nivel(es) de altura libre baja`,
      detail:
        `${low.map((floor) => `"${floor.name}" (${floor.height.toFixed(2)} m)`).join(", ")}. ` +
        `Por debajo de ${LOW_CEILING.toFixed(2)} m conviene comprobar la altura minima exigida donde vayas a construir.`,
      entityIds: low.map((floor) => floor.id),
    },
  ];
}

/** Escaleras incomodas. */
function checkStairs(scene: SceneDocument): Diagnostic[] {
  const uncomfortable = scene.stairs.filter(
    (stair) => stair.riser > MAX_RISER || stair.tread < MIN_TREAD,
  );

  const findings: Diagnostic[] = [];

  if (uncomfortable.length > 0) {
    findings.push({
      rule: "stair-proportions",
      severity: "warning",
      title: `${uncomfortable.length} escalera(s) de paso incomodo`,
      detail:
        uncomfortable
          .map(
            (stair) =>
              `"${stair.name}": contrahuella ${(stair.riser * 100).toFixed(0)} cm, huella ${(stair.tread * 100).toFixed(0)} cm`,
          )
          .join("; ") +
        `. Se camina comodo con contrahuella hasta ${(MAX_RISER * 100).toFixed(0)} cm y huella desde ${(MIN_TREAD * 100).toFixed(0)} cm.`,
      entityIds: uncomfortable.map((stair) => stair.id),
    });
  }

  /** Varios niveles sin forma de subir. */
  if (scene.floors.length > 1 && scene.stairs.length === 0) {
    findings.push({
      rule: "stair-missing",
      severity: "info",
      title: "Hay varios niveles y ninguna escalera",
      detail:
        "El modelo tiene mas de un nivel pero no hay escalera ni indicacion de como se sube.",
      entityIds: [],
    });
  }

  return findings;
}

/** Muros sin material asignado. */
function checkMaterials(scene: SceneDocument): Diagnostic[] {
  const bare = scene.walls.filter(
    (wall) => !wall.materialInteriorId && !wall.materialExteriorId,
  );
  if (bare.length === 0 || scene.walls.length === 0) return [];

  return [
    {
      rule: "wall-no-material",
      severity: "info",
      title: `${bare.length} de ${scene.walls.length} muros sin material`,
      detail:
        "Se muestran con el acabado por defecto. Abre la biblioteca de materiales (tecla G) " +
        "y arrastra uno sobre el muro, o usa el pincel.",
      entityIds: bare.map((wall) => wall.id),
    },
  ];
}

/** El modelo esta vacio. */
function checkEmpty(scene: SceneDocument): Diagnostic[] {
  if (scene.walls.length > 0) return [];
  return [
    {
      rule: "scene-empty",
      severity: "info",
      title: "Todavia no hay muros",
      detail:
        "Empieza trazando el contorno con la tecla L, o importa un plano desde el panel Plano " +
        "para calcarlo a escala.",
      entityIds: [],
    },
  ];
}

const RULES: ((scene: SceneDocument) => Diagnostic[])[] = [
  checkEmpty,
  checkOpenings,
  checkDuplicateWalls,
  checkTinyWalls,
  checkRoomAccess,
  checkOpenCorners,
  checkDaylight,
  checkCeilingHeight,
  checkStairs,
  checkMaterials,
];

const SEVERITY_ORDER: Record<Diagnostic["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** Ejecuta todas las reglas y ordena por gravedad. */
export function reviewScene(scene: SceneDocument): Diagnostic[] {
  const findings = RULES.flatMap((rule) => rule(scene));
  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

/** Resumen de una revision en una frase. */
export function summarizeReview(findings: readonly Diagnostic[]): string {
  if (findings.length === 0) {
    return "He revisado el modelo y no encuentro nada que corregir.";
  }

  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  const infos = findings.length - errors - warnings;

  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} problema(s)`);
  if (warnings > 0) parts.push(`${warnings} aviso(s)`);
  if (infos > 0) parts.push(`${infos} sugerencia(s)`);

  return `He revisado el modelo: ${parts.join(", ")}.`;
}
