import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createDefaultScene,
  withRecomputedRooms,
} from "@archvision/shared";
import type { SceneCommand, SceneDocument } from "@archvision/types";
import { planLocally } from "./planner";
import { parseDimensions, parseMeasures } from "./intents";
import { reviewScene } from "./diagnostics";
import { buildSceneDigest, renderSceneDigest } from "./digest";
import { executeTool } from "./prompt";
import { lessonProgress, nextTutorialStep, TUTORIAL } from "./tutorial";
import type { AssistantContext } from "./types";

const CONTEXT: AssistantContext = {
  projectName: "Prueba",
  selection: [],
  activeFloorId: null,
};

function apply(scene: SceneDocument, commands: readonly SceneCommand[]): SceneDocument {
  return withRecomputedRooms(
    commands.reduce((current, command) => applyCommand(current, command), scene),
  );
}

describe("lectura de medidas", () => {
  it("asume metros y reconoce la unidad escrita", () => {
    expect(parseMeasures("de 4 metros")).toEqual([4]);
    expect(parseMeasures("80 cm")).toEqual([0.8]);
    expect(parseMeasures("2,70")).toEqual([2.7]);
  });

  it("interpreta un numero grande sin unidad como centimetros", () => {
    // Nadie pide un muro de 240 metros de alto, pero si de 240 cm.
    expect(parseMeasures("altura 240")).toEqual([2.4]);
  });

  it("lee dimensiones cruzadas", () => {
    expect(parseDimensions("4x3")).toEqual({ a: 4, b: 3 });
    expect(parseDimensions("4,5 por 3")).toEqual({ a: 4.5, b: 3 });
    expect(parseDimensions("sin medidas")).toBeNull();
  });
});

describe("crear una habitacion", () => {
  it("produce cuatro muros que cierran y generan una habitacion real", () => {
    const scene = createDefaultScene();
    const turn = planLocally({
      message: "crea una habitacion de 4x3",
      scene,
      context: CONTEXT,
    });

    expect(turn.actions).toHaveLength(1);
    const commands = turn.actions[0]?.commands ?? [];
    expect(commands).toHaveLength(4);
    expect(commands.every((command) => command.type === "CREATE_WALL")).toBe(true);

    // La prueba de verdad no es el numero de comandos, sino que el reductor
    // los acepte y que la deteccion encuentre el recinto cerrado.
    const next = apply(scene, commands);
    expect(next.walls).toHaveLength(4);
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0]?.area).toBeCloseTo(4 * 3, 1);
  });

  it("no superpone la segunda habitacion sobre la primera", () => {
    const scene = createDefaultScene();
    const first = planLocally({
      message: "crea una habitacion de 4x3",
      scene,
      context: CONTEXT,
    });
    const afterFirst = apply(scene, first.actions[0]?.commands ?? []);

    const second = planLocally({
      message: "crea otra habitacion de 3x3",
      scene: afterFirst,
      context: CONTEXT,
    });
    const afterSecond = apply(afterFirst, second.actions[0]?.commands ?? []);

    expect(afterSecond.rooms).toHaveLength(2);
  });

  it("rechaza medidas absurdas en vez de crear geometria", () => {
    const scene = createDefaultScene();
    const turn = planLocally({
      message: "crea una habitacion de 0.1 x 0.2",
      scene,
      context: CONTEXT,
    });

    expect(turn.actions).toHaveLength(0);
    expect(turn.reply).toContain("no parecen");
  });
});

describe("puertas y ventanas", () => {
  function sceneWithRoom(): SceneDocument {
    const scene = createDefaultScene();
    const turn = planLocally({
      message: "crea una habitacion de 5x4",
      scene,
      context: CONTEXT,
    });
    return apply(scene, turn.actions[0]?.commands ?? []);
  }

  it("coloca la puerta en el muro mas largo y centrada", () => {
    const scene = sceneWithRoom();
    const turn = planLocally({
      message: "anade una puerta",
      scene,
      context: CONTEXT,
    });

    const next = apply(scene, turn.actions[0]?.commands ?? []);
    expect(next.doors).toHaveLength(1);

    const door = next.doors[0];
    const wall = next.walls.find((item) => item.id === door?.wallId);
    expect(wall).toBeDefined();
    // Muro de 5 m: el hueco cae en su punto medio.
    expect(door?.offset).toBeCloseTo(2.5, 2);
  });

  it("se niega cuando el hueco no cabe", () => {
    const scene = sceneWithRoom();
    const turn = planLocally({
      message: "anade una ventana de 9 x 1",
      scene,
      context: CONTEXT,
    });

    expect(turn.actions).toHaveLength(0);
    expect(turn.reply).toContain("no cabe");
  });
});

describe("materiales", () => {
  it("encuentra el material por su familia y lo aplica a los muros", () => {
    const base = createDefaultScene();
    const room = planLocally({
      message: "crea una habitacion de 4x4",
      scene: base,
      context: CONTEXT,
    });
    const scene = apply(base, room.actions[0]?.commands ?? []);

    const turn = planLocally({
      message: "pinta los muros de ladrillo",
      scene,
      context: CONTEXT,
    });

    const next = apply(scene, turn.actions[0]?.commands ?? []);
    expect(next.walls.every((wall) => wall.materialInteriorId)).toBe(true);
    expect(turn.reply).toContain("Ladrillo");
  });
});

describe("revision del modelo", () => {
  it("avisa de una habitacion sin acceso", () => {
    const base = createDefaultScene();
    const room = planLocally({
      message: "crea una habitacion de 4x3",
      scene: base,
      context: CONTEXT,
    });
    const scene = apply(base, room.actions[0]?.commands ?? []);

    const findings = reviewScene(scene);
    expect(findings.some((item) => item.rule === "room-no-access")).toBe(true);
    expect(findings.some((item) => item.rule === "room-daylight")).toBe(true);
  });

  it("detecta muros duplicados y ofrece quitarlos", () => {
    const scene = createDefaultScene();
    const floorId = scene.floors[0]?.id ?? "";
    const wall: SceneCommand = {
      type: "CREATE_WALL",
      floorId,
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
    };
    const next = apply(scene, [wall, wall]);

    const duplicate = reviewScene(next).find((item) => item.rule === "wall-duplicate");
    expect(duplicate).toBeDefined();
    expect(duplicate?.fix?.commands).toHaveLength(1);

    // La correccion propuesta tiene que ser aplicable tal cual.
    const fixed = apply(next, duplicate?.fix?.commands ?? []);
    expect(fixed.walls).toHaveLength(1);
  });

  it("no inventa problemas en una escena recien creada", () => {
    const findings = reviewScene(createDefaultScene());
    expect(findings.every((item) => item.severity === "info")).toBe(true);
  });

  it("responde a la peticion de revision con hallazgos", () => {
    const turn = planLocally({
      message: "revisa el modelo",
      scene: createDefaultScene(),
      context: CONTEXT,
    });
    expect(turn.diagnostics).toBeDefined();
    expect(turn.actions).toHaveLength(0);
  });
});

describe("conciencia del proyecto", () => {
  it("resume el estado real y no el esperado", () => {
    const base = createDefaultScene();
    const room = planLocally({
      message: "crea una habitacion de 4x3",
      scene: base,
      context: CONTEXT,
    });
    const scene = apply(base, room.actions[0]?.commands ?? []);

    const digest = buildSceneDigest(scene, { ...CONTEXT, projectName: "Casa" });
    const text = renderSceneDigest(digest);

    expect(digest.empty).toBe(false);
    expect(digest.metrics.roomCount).toBe(1);
    expect(text).toContain("Casa");
    expect(text).toContain("Planta baja");
  });

  it("dice que esta vacio cuando lo esta", () => {
    const digest = buildSceneDigest(createDefaultScene(), CONTEXT);
    expect(digest.empty).toBe(true);
    expect(renderSceneDigest(digest)).toContain("vacio");
  });
});

describe("herramientas del modelo", () => {
  it("cada herramienta declarada tiene un ejecutor", () => {
    const scene = createDefaultScene();
    const names = [
      "crear_habitacion",
      "crear_vano",
      "aplicar_material",
      "cambiar_altura_muros",
      "crear_nivel",
      "crear_cubierta",
      "crear_columna",
      "anadir_mueble",
      "eliminar_seleccion",
      "renombrar_seleccion",
      "revisar_modelo",
    ];

    for (const name of names) {
      expect(executeTool(name, {}, scene, CONTEXT), name).not.toBeNull();
    }
  });

  it("ignora una herramienta inventada", () => {
    expect(
      executeTool("borrar_todo", {}, createDefaultScene(), CONTEXT),
    ).toBeNull();
  });

  it("produce los mismos comandos que la ruta local", () => {
    const scene = createDefaultScene();
    const local = planLocally({
      message: "crea una habitacion de 4x3",
      scene,
      context: CONTEXT,
    });
    const tool = executeTool(
      "crear_habitacion",
      { ancho: 4, fondo: 3 },
      scene,
      CONTEXT,
    );

    expect(tool?.result?.actions[0]?.commands).toEqual(
      local.actions[0]?.commands,
    );
  });
});

describe("tutorial", () => {
  it("marca los pasos segun lo que demuestra el documento", () => {
    const lesson = TUTORIAL[0];
    expect(lesson).toBeDefined();

    const empty = lessonProgress(lesson!, createDefaultScene());
    expect(empty.done).toBe(0);

    const base = createDefaultScene();
    const room = planLocally({
      message: "crea una habitacion de 4x3",
      scene: base,
      context: CONTEXT,
    });
    const scene = apply(base, room.actions[0]?.commands ?? []);

    const after = lessonProgress(lesson!, scene);
    expect(after.done).toBeGreaterThanOrEqual(2);
    expect(after.nextStepId).toBe("colocar-puerta");
  });

  it("sugiere el primer paso pendiente del recorrido completo", () => {
    const next = nextTutorialStep(createDefaultScene());
    expect(next?.step.id).toBe("trazar-muros");
  });
});

describe("preguntas sobre el editor", () => {
  it("responde con conocimiento de la aplicacion", () => {
    const turn = planLocally({
      message: "como importo un plano escaneado",
      scene: createDefaultScene(),
      context: CONTEXT,
    });

    expect(turn.actions).toHaveLength(0);
    expect(turn.reply.toLowerCase()).toContain("escala");
  });

  it("reconoce lo que la aplicacion no hace", () => {
    const turn = planLocally({
      message: "puedo exportar a glb",
      scene: createDefaultScene(),
      context: CONTEXT,
    });
    // Lo importante no es la palabra exacta, sino que no prometa la funcion.
    expect(turn.reply.toLowerCase()).toContain("no existen");
    expect(turn.actions).toHaveLength(0);
  });

  it("no propone cambios cuando no entiende", () => {
    const turn = planLocally({
      message: "xyzzy",
      scene: createDefaultScene(),
      context: CONTEXT,
    });
    expect(turn.actions).toHaveLength(0);
    expect(turn.followUps.length).toBeGreaterThan(0);
  });
});
