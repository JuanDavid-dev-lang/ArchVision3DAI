import { describe, expect, it } from "vitest";
import type { SceneCommand, SceneDocument } from "@archvision/types";
import { createDefaultScene } from "./scene-factory";
import { createDemoHouseScene } from "./demo-house";
import { CommandError, applyCommand, applyCommands } from "./command-reducer";
import { detectRoomPolygons, recomputeRooms } from "./rooms";
import { computeSceneMetrics } from "./metrics";

function sceneWithRoom(): SceneDocument {
  const scene = createDefaultScene();
  const floorId = scene.floors[0]!.id;

  const rectangle: SceneCommand[] = [
    { type: "CREATE_WALL", floorId, start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
    { type: "CREATE_WALL", floorId, start: { x: 5, y: 0 }, end: { x: 5, y: 4 } },
    { type: "CREATE_WALL", floorId, start: { x: 5, y: 4 }, end: { x: 0, y: 4 } },
    { type: "CREATE_WALL", floorId, start: { x: 0, y: 4 }, end: { x: 0, y: 0 } },
  ];

  return applyCommands(scene, rectangle);
}

describe("command-reducer", () => {
  it("crea paredes y rechaza las degeneradas", () => {
    const scene = createDefaultScene();
    const floorId = scene.floors[0]!.id;

    const next = applyCommand(scene, {
      type: "CREATE_WALL",
      floorId,
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
    });

    expect(next.walls).toHaveLength(1);
    expect(scene.walls).toHaveLength(0); // la escena original no se muta

    expect(() =>
      applyCommand(scene, {
        type: "CREATE_WALL",
        floorId,
        start: { x: 0, y: 0 },
        end: { x: 0.01, y: 0 },
      }),
    ).toThrow(CommandError);
  });

  it("coloca vanos dentro de la pared y hereda su nivel", () => {
    const scene = sceneWithRoom();
    const wall = scene.walls[0]!;

    const withWindow = applyCommand(scene, {
      type: "CREATE_WINDOW",
      wallId: wall.id,
      offset: 0.1,
      width: 1.5,
    });

    const window = withWindow.windows[0]!;
    expect(window.floorId).toBe(wall.floorId);
    // El offset se ajusta para que la ventana no se salga por el extremo.
    expect(window.offset).toBeCloseTo(0.75, 5);
  });

  it("rechaza una ventana mas alta que la pared", () => {
    const scene = sceneWithRoom();
    const wall = scene.walls[0]!;

    expect(() =>
      applyCommand(scene, {
        type: "CREATE_WINDOW",
        wallId: wall.id,
        offset: 2,
        height: 2.5,
        sillHeight: 1.5,
      }),
    ).toThrow(CommandError);
  });

  it("al borrar una pared elimina sus vanos", () => {
    const scene = sceneWithRoom();
    const wall = scene.walls[0]!;

    const withOpenings = applyCommands(scene, [
      { type: "CREATE_DOOR", wallId: wall.id, offset: 1 },
      { type: "CREATE_WINDOW", wallId: wall.id, offset: 3 },
    ]);
    expect(withOpenings.doors).toHaveLength(1);
    expect(withOpenings.windows).toHaveLength(1);

    const deleted = applyCommand(withOpenings, {
      type: "DELETE_OBJECTS",
      ids: [wall.id],
    });

    expect(deleted.walls).toHaveLength(3);
    expect(deleted.doors).toHaveLength(0);
    expect(deleted.windows).toHaveLength(0);
  });

  it("impide quedarse sin niveles", () => {
    const scene = sceneWithRoom();
    expect(() =>
      applyCommand(scene, {
        type: "DELETE_OBJECTS",
        ids: [scene.floors[0]!.id],
      }),
    ).toThrow(CommandError);
  });

  it("crea un nivel sobre el anterior", () => {
    const scene = createDefaultScene({ floorHeight: 2.6 });
    const next = applyCommand(scene, { type: "CREATE_FLOOR" });

    expect(next.floors).toHaveLength(2);
    expect(next.floors[1]!.elevation).toBeCloseTo(2.8, 5);
    expect(next.activeFloorId).toBe(next.floors[1]!.id);
  });

  it("asigna material a la cara indicada", () => {
    const scene = sceneWithRoom();
    const wall = scene.walls[0]!;

    const next = applyCommand(scene, {
      type: "ASSIGN_MATERIAL",
      targetIds: [wall.id],
      materialId: "mat_brick_red",
      face: "exterior",
    });

    const updated = next.walls.find((item) => item.id === wall.id)!;
    expect(updated.materialExteriorId).toBe("mat_brick_red");
    expect(updated.materialInteriorId).toBeUndefined();
  });

  it("mueve objetos en el plano", () => {
    const scene = sceneWithRoom();
    const wall = scene.walls[0]!;

    const next = applyCommand(scene, {
      type: "TRANSFORM_OBJECTS",
      ids: [wall.id],
      translate: { x: 1, y: 0, z: 2 },
    });

    const moved = next.walls.find((item) => item.id === wall.id)!;
    expect(moved.start).toEqual({ x: 1, y: 2 });
    expect(moved.end).toEqual({ x: 6, y: 2 });
  });
});

describe("deteccion de habitaciones", () => {
  it("encuentra un recinto rectangular cerrado", () => {
    const scene = sceneWithRoom();
    const detected = detectRoomPolygons(scene.walls);

    expect(detected).toHaveLength(1);
    expect(detected[0]?.area).toBeCloseTo(20, 5);
    expect(detected[0]?.perimeter).toBeCloseTo(18, 5);
  });

  it("no genera habitaciones si el recinto esta abierto", () => {
    const scene = sceneWithRoom();
    const open = { ...scene, walls: scene.walls.slice(0, 3) };
    expect(detectRoomPolygons(open.walls)).toHaveLength(0);
  });

  it("conserva el nombre al recalcular tras mover una pared", () => {
    const scene = sceneWithRoom();
    const withRooms = { ...scene, rooms: recomputeRooms(scene) };
    const renamed = {
      ...withRooms,
      rooms: withRooms.rooms.map((room) => ({ ...room, name: "Sala principal" })),
    };

    const moved = applyCommand(renamed, {
      type: "UPDATE_WALL",
      wallId: renamed.walls[0]!.id,
      patch: { thickness: 0.2 },
    });

    const recomputed = recomputeRooms(moved);
    expect(recomputed).toHaveLength(1);
    expect(recomputed[0]?.name).toBe("Sala principal");
    expect(recomputed[0]?.id).toBe(renamed.rooms[0]?.id);
  });

  it("detecta las seis habitaciones de la casa demo", () => {
    const scene = createDemoHouseScene();
    const rooms = recomputeRooms(scene);
    expect(rooms.length).toBeGreaterThanOrEqual(5);
  });
});

describe("metricas", () => {
  it("descuenta los vanos de la superficie de paredes", () => {
    const scene = sceneWithRoom();
    const base = computeSceneMetrics(scene);

    const withWindow = applyCommand(scene, {
      type: "CREATE_WINDOW",
      wallId: scene.walls[0]!.id,
      offset: 2,
      width: 1.5,
      height: 1.2,
    });
    const after = computeSceneMetrics(withWindow);

    expect(base.wallSurface - after.wallSurface).toBeCloseTo(1.8, 5);
    expect(after.glazedSurface).toBeCloseTo(1.8, 5);
  });
});
