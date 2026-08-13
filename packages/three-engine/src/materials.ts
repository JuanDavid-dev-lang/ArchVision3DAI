import {
  Color,
  DoubleSide,
  FrontSide,
  MeshStandardMaterial,
  Vector2,
  type Material,
} from "three";
import type { MaterialDefinition } from "@archvision/types";
import { patternTextures } from "./textures";

/**
 * Materiales de la escena.
 *
 * Un `MaterialDefinition` serializable se traduce a un material PBR de Three.js
 * y se cachea por identidad de parametros. El aspecto sale de tres partes:
 * color base, constantes PBR (rugosidad, metalicidad, opacidad) y, si el
 * material declara `texture`, los mapas generados por procedimiento.
 *
 * Las texturas se comparten entre materiales del mismo patron; lo unico que se
 * clona por material es la repeticion (`repeat`), que depende del tamano de
 * tesela en metros.
 */

export interface MaterialResolution {
  material: MeshStandardMaterial;
  transparent: boolean;
}

function materialKey(definition: MaterialDefinition): string {
  return [
    definition.id,
    definition.baseColor,
    definition.roughness.toFixed(3),
    definition.metalness.toFixed(3),
    definition.opacity.toFixed(3),
    definition.texture ?? "plain",
    (definition.bump ?? 0).toFixed(2),
    definition.tiling ? `${definition.tiling.x}x${definition.tiling.y}` : "1x1",
  ].join("#");
}

export class MaterialLibrary {
  private readonly cache = new Map<string, MeshStandardMaterial>();
  private fallback: MeshStandardMaterial | null = null;

  /** Material PBR para una definicion; reutiliza la instancia si ya existe. */
  resolve(definition: MaterialDefinition): MeshStandardMaterial {
    const key = materialKey(definition);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const transparent = definition.opacity < 1;
    const material = new MeshStandardMaterial({
      color: new Color(definition.baseColor),
      roughness: definition.roughness,
      metalness: definition.metalness,
      opacity: definition.opacity,
      transparent,
      // El vidrio se ve por ambas caras; el resto solo por la exterior.
      side: transparent ? DoubleSide : FrontSide,
      depthWrite: !transparent,
    });
    material.name = definition.name;

    this.applyTexture(material, definition);

    this.cache.set(key, material);
    return material;
  }

  /**
   * Adjunta los mapas del patron.
   *
   * `tiling` esta en metros por tesela y las coordenadas UV de la escena se
   * generan tambien en metros, asi que la repeticion es su inversa: una tesela
   * de 0.6 m repite 1.667 veces por metro.
   */
  private applyTexture(
    material: MeshStandardMaterial,
    definition: MaterialDefinition,
  ): void {
    const pattern = definition.texture;
    if (!pattern || pattern === "plain") return;

    // El vidrio translucido con relieve produce artefactos y no aporta nada.
    if (definition.opacity < 1) return;

    const textures = patternTextures(pattern);
    const tiling = definition.tiling ?? { x: 1, y: 1 };
    const repeatX = 1 / Math.max(0.01, tiling.x);
    const repeatY = 1 / Math.max(0.01, tiling.y);
    const rotation = ((definition.rotationDeg ?? 0) * Math.PI) / 180;
    const offset = definition.offset ?? { x: 0, y: 0 };

    // Cada material necesita su propia transformacion de UV, pero puede
    // compartir los pixeles: `clone()` de una textura reutiliza la imagen y
    // solo duplica los parametros de muestreo.
    const map = textures.map.clone();
    const normalMap = textures.normalMap.clone();
    const roughnessMap = textures.roughnessMap.clone();

    for (const texture of [map, normalMap, roughnessMap]) {
      texture.repeat.set(repeatX, repeatY);
      texture.rotation = rotation;
      texture.offset.set(offset.x, offset.y);
      texture.needsUpdate = true;
    }

    material.map = map;
    material.roughnessMap = roughnessMap;

    const bump = definition.bump ?? 0;
    if (bump > 0) {
      material.normalMap = normalMap;
      material.normalScale = new Vector2(bump, bump);
    }

    material.needsUpdate = true;
  }

  /** Material neutro para entidades sin material asignado. */
  getFallback(): MeshStandardMaterial {
    if (this.fallback) return this.fallback;
    this.fallback = new MeshStandardMaterial({
      color: new Color("#d7d3cb"),
      roughness: 0.85,
      metalness: 0,
    });
    this.fallback.name = "Sin material";
    return this.fallback;
  }

  /** Busca la definicion en la escena y devuelve su material o el neutro. */
  resolveById(
    materialId: string | undefined,
    definitions: readonly MaterialDefinition[],
  ): MeshStandardMaterial {
    if (!materialId) return this.getFallback();
    const definition = definitions.find((item) => item.id === materialId);
    return definition ? this.resolve(definition) : this.getFallback();
  }

  dispose(): void {
    for (const material of this.cache.values()) {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.dispose();
    }
    this.cache.clear();
    this.fallback?.dispose();
    this.fallback = null;
  }
}

export const materialLibrary = new MaterialLibrary();

/** Libera cualquier material o geometria adjunto a un objeto. */
export function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
    return;
  }
  material.dispose();
}
