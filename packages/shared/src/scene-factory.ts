import {
  createEmptyScene,
  type Floor,
  type SceneDocument,
  type UnitSystem,
} from "@archvision/types";
import { createId } from "./ids";
import { DEFAULTS } from "./defaults";
import { builtinMaterials } from "./material-catalog";

export function createFloor(params: {
  name: string;
  level: number;
  elevation: number;
  height?: number;
}): Floor {
  return {
    id: createId(),
    name: params.name,
    level: params.level,
    elevation: params.elevation,
    height: params.height ?? DEFAULTS.floor.height,
    visible: true,
    locked: false,
  };
}

/**
 * Escena inicial de un proyecto nuevo: una planta baja vacia, materiales
 * base, sol y luz ambiental. Suficiente para abrir el editor y dibujar.
 */
export function createDefaultScene(options?: {
  displayUnit?: UnitSystem;
  floorHeight?: number;
  floorsCount?: number;
}): SceneDocument {
  const scene = createEmptyScene();
  scene.displayUnit = options?.displayUnit ?? "m";

  const floorHeight = options?.floorHeight ?? DEFAULTS.floor.height;
  const floorsCount = Math.max(1, Math.min(options?.floorsCount ?? 1, 20));

  for (let i = 0; i < floorsCount; i += 1) {
    scene.floors.push(
      createFloor({
        name: i === 0 ? "Planta baja" : `Piso ${i + 1}`,
        level: i,
        elevation: i * floorHeight,
        height: floorHeight,
      }),
    );
  }

  scene.activeFloorId = scene.floors[0]?.id ?? null;
  scene.materials = builtinMaterials();

  scene.lights = [
    {
      id: createId(),
      name: "Sol",
      kind: "sun",
      position: { x: 12, y: 18, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      intensity: 2.2,
      color: "#fff4e0",
      temperature: 5600,
      castShadow: true,
      visible: true,
      locked: false,
    },
    {
      id: createId(),
      name: "Ambiental",
      kind: "ambient",
      position: { x: 0, y: 0, z: 0 },
      intensity: 0.45,
      color: "#cfe0ff",
      castShadow: false,
      visible: true,
      locked: false,
    },
  ];

  return scene;
}
