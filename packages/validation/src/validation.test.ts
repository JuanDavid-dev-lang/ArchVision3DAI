import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth";
import { createProjectSchema } from "./project";
import { sceneDocumentSchema, validateSceneReferences } from "./scene";
import { parseSceneCommand } from "./commands";
import { createEmptyScene, type SceneDocument } from "@archvision/types";

describe("auth", () => {
  it("rechaza contrasenas debiles", () => {
    const result = registerSchema.safeParse({
      name: "Ana Torres",
      email: "ana@estudio.com",
      password: "corta1",
    });
    expect(result.success).toBe(false);
  });

  it("normaliza el correo a minusculas", () => {
    const result = registerSchema.parse({
      name: "Ana Torres",
      email: "  Ana@Estudio.COM ",
      password: "casa1234segura",
    });
    expect(result.email).toBe("ana@estudio.com");
  });
});

describe("project", () => {
  it("aplica valores por defecto", () => {
    const result = createProjectSchema.parse({ name: "Casa Los Robles" });
    expect(result.type).toBe("house");
    expect(result.units).toBe("m");
    expect(result.floorHeight).toBe(2.6);
    expect(result.floorsCount).toBe(1);
  });

  it("rechaza alturas de piso imposibles", () => {
    const result = createProjectSchema.safeParse({
      name: "Casa Los Robles",
      floorHeight: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("scene", () => {
  it("valida una escena vacia", () => {
    const result = sceneDocumentSchema.safeParse(createEmptyScene());
    expect(result.success).toBe(true);
  });

  it("detecta vanos huerfanos", () => {
    const scene: SceneDocument = createEmptyScene();
    scene.floors.push({
      id: "floor-1",
      name: "Planta baja",
      level: 0,
      elevation: 0,
      height: 2.6,
      visible: true,
      locked: false,
    });
    scene.doors.push({
      id: "door-1",
      wallId: "wall-inexistente",
      floorId: "floor-1",
      name: "Puerta principal",
      kind: "single",
      offset: 1,
      width: 0.9,
      height: 2.05,
      openingDirection: "inward-left",
      visible: true,
      locked: false,
    });

    const problems = validateSceneReferences(scene);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("pared inexistente");
  });
});

describe("commands", () => {
  it("acepta un comando valido de creacion de ventana", () => {
    const result = parseSceneCommand({
      type: "CREATE_WINDOW",
      wallId: "wall-1",
      offset: 1.5,
      width: 1.5,
      height: 1.2,
    });
    expect(result.ok).toBe(true);
  });

  it("rechaza comandos desconocidos", () => {
    const result = parseSceneCommand({ type: "DROP_DATABASE" });
    expect(result.ok).toBe(false);
  });

  it("acepta columnas y actualizaciones de cubierta", () => {
    expect(
      parseSceneCommand({
        type: "CREATE_COLUMN",
        floorId: "floor-1",
        position: { x: 2, y: 3 },
      }).ok,
    ).toBe(true);

    expect(
      parseSceneCommand({
        type: "UPDATE_ROOF",
        roofId: "roof-1",
        patch: { slopeDeg: 35 },
      }).ok,
    ).toBe(true);

    // Una pendiente vertical no describe una cubierta valida.
    expect(
      parseSceneCommand({
        type: "UPDATE_ROOF",
        roofId: "roof-1",
        patch: { slopeDeg: 90 },
      }).ok,
    ).toBe(false);
  });

  it("rechaza dimensiones fuera de rango", () => {
    const result = parseSceneCommand({
      type: "CREATE_WINDOW",
      wallId: "wall-1",
      offset: 1.5,
      width: 9000,
    });
    expect(result.ok).toBe(false);
  });
});
