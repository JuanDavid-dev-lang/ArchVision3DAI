import type { MaterialCategory, MaterialDefinition } from "@archvision/types";

/**
 * Catalogo de materiales de fabrica.
 *
 * Los identificadores son estables y legibles (`mat_brick_red`) en lugar de
 * aleatorios: aparecen dentro de escenas guardadas y de proyectos exportados,
 * y un catalogo compartido solo sirve si el mismo material significa lo mismo
 * en todos los proyectos. Los materiales del usuario si llevan id generado.
 *
 * Ninguna entrada referencia archivos: el aspecto sale de un patron procedural
 * (`texture`) que se sintetiza en el cliente. Asi el catalogo pesa unos pocos
 * kilobytes de texto y funciona sin conexion.
 */

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  brick: "Ladrillo",
  concrete: "Concreto",
  wood: "Madera",
  glass: "Vidrio",
  metal: "Metal",
  ceramic: "Ceramica",
  stone: "Piedra",
  paint: "Pintura",
  plaster: "Revoque",
  marble: "Marmol",
  "roof-tile": "Cubierta",
};

/** Superficies a las que suele aplicarse cada material. */
export type MaterialUsage = "wall" | "floor" | "roof" | "furniture" | "opening";

export interface CatalogMaterial extends MaterialDefinition {
  builtin: true;
  usage: readonly MaterialUsage[];
}

const catalog: CatalogMaterial[] = [
  // --- Revoques y pinturas -------------------------------------------------
  {
    id: "mat_plaster_white",
    name: "Yeso blanco",
    category: "plaster",
    baseColor: "#eceae5",
    roughness: 0.9,
    metalness: 0,
    opacity: 1,
    texture: "stucco",
    bump: 0.25,
    tiling: { x: 1, y: 1 },
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_stucco_sand",
    name: "Revoque arena",
    category: "plaster",
    baseColor: "#d9cdb4",
    roughness: 0.92,
    metalness: 0,
    opacity: 1,
    texture: "stucco",
    bump: 0.45,
    tiling: { x: 1, y: 1 },
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_paint_terracotta",
    name: "Pintura terracota",
    category: "paint",
    baseColor: "#c06a4a",
    roughness: 0.75,
    metalness: 0,
    opacity: 1,
    texture: "plain",
    bump: 0,
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_paint_olive",
    name: "Pintura oliva",
    category: "paint",
    baseColor: "#6f7551",
    roughness: 0.78,
    metalness: 0,
    opacity: 1,
    texture: "plain",
    bump: 0,
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_paint_indigo",
    name: "Pintura indigo",
    category: "paint",
    baseColor: "#3f4d69",
    roughness: 0.72,
    metalness: 0,
    opacity: 1,
    texture: "plain",
    bump: 0,
    builtin: true,
    usage: ["wall"],
  },

  // --- Ladrillo y bloque ---------------------------------------------------
  {
    id: "mat_brick_red",
    name: "Ladrillo rojo",
    category: "brick",
    baseColor: "#9c4a30",
    roughness: 0.85,
    metalness: 0,
    opacity: 1,
    texture: "brick",
    bump: 0.85,
    tiling: { x: 1.2, y: 0.6 },
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_brick_white",
    name: "Ladrillo blanqueado",
    category: "brick",
    baseColor: "#cfc7bd",
    roughness: 0.88,
    metalness: 0,
    opacity: 1,
    texture: "brick",
    bump: 0.7,
    tiling: { x: 1.2, y: 0.6 },
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_block_gray",
    name: "Bloque de hormigon",
    category: "concrete",
    baseColor: "#9a9a94",
    roughness: 0.9,
    metalness: 0,
    opacity: 1,
    texture: "block",
    bump: 0.7,
    tiling: { x: 1.6, y: 0.8 },
    builtin: true,
    usage: ["wall"],
  },

  // --- Concreto y piedra ---------------------------------------------------
  {
    id: "mat_concrete",
    name: "Concreto a la vista",
    category: "concrete",
    baseColor: "#8d8d88",
    roughness: 0.8,
    metalness: 0,
    opacity: 1,
    texture: "concrete",
    bump: 0.3,
    tiling: { x: 2, y: 2 },
    builtin: true,
    usage: ["wall", "floor"],
  },
  {
    id: "mat_concrete_polished",
    name: "Concreto pulido",
    category: "concrete",
    baseColor: "#a6a6a1",
    roughness: 0.35,
    metalness: 0,
    opacity: 1,
    texture: "concrete",
    bump: 0.12,
    tiling: { x: 3, y: 3 },
    builtin: true,
    usage: ["floor"],
  },
  {
    id: "mat_stone_slate",
    name: "Piedra pizarra",
    category: "stone",
    baseColor: "#5c6066",
    roughness: 0.85,
    metalness: 0,
    opacity: 1,
    texture: "stone",
    bump: 0.9,
    tiling: { x: 1.5, y: 1 },
    builtin: true,
    usage: ["wall", "floor"],
  },
  {
    id: "mat_stone_sand",
    name: "Piedra arenisca",
    category: "stone",
    baseColor: "#b9a688",
    roughness: 0.88,
    metalness: 0,
    opacity: 1,
    texture: "stone",
    bump: 0.8,
    tiling: { x: 1.5, y: 1 },
    builtin: true,
    usage: ["wall"],
  },
  {
    id: "mat_gravel",
    name: "Grava",
    category: "stone",
    baseColor: "#8b857c",
    roughness: 0.95,
    metalness: 0,
    opacity: 1,
    texture: "gravel",
    bump: 1,
    tiling: { x: 1, y: 1 },
    builtin: true,
    usage: ["floor"],
  },

  // --- Madera --------------------------------------------------------------
  {
    id: "mat_wood_oak",
    name: "Madera roble",
    category: "wood",
    baseColor: "#a9773f",
    roughness: 0.6,
    metalness: 0,
    opacity: 1,
    texture: "wood-planks",
    bump: 0.35,
    tiling: { x: 2, y: 0.22 },
    builtin: true,
    usage: ["floor", "furniture"],
  },
  {
    id: "mat_wood_walnut",
    name: "Madera nogal",
    category: "wood",
    baseColor: "#5d3a24",
    roughness: 0.55,
    metalness: 0,
    opacity: 1,
    texture: "wood-planks",
    bump: 0.35,
    tiling: { x: 2, y: 0.22 },
    builtin: true,
    usage: ["floor", "furniture"],
  },
  {
    id: "mat_wood_pine",
    name: "Madera pino",
    category: "wood",
    baseColor: "#d6b183",
    roughness: 0.68,
    metalness: 0,
    opacity: 1,
    texture: "wood-planks",
    bump: 0.3,
    tiling: { x: 2, y: 0.22 },
    builtin: true,
    usage: ["floor", "furniture", "opening"],
  },
  {
    id: "mat_wood_parquet",
    name: "Parquet",
    category: "wood",
    baseColor: "#b07f45",
    roughness: 0.45,
    metalness: 0,
    opacity: 1,
    texture: "wood-parquet",
    bump: 0.3,
    tiling: { x: 0.9, y: 0.9 },
    builtin: true,
    usage: ["floor"],
  },

  // --- Ceramica y marmol ---------------------------------------------------
  {
    id: "mat_ceramic_floor",
    name: "Ceramica gris",
    category: "ceramic",
    baseColor: "#b8b6b1",
    roughness: 0.35,
    metalness: 0,
    opacity: 1,
    texture: "ceramic-tile",
    bump: 0.4,
    tiling: { x: 0.6, y: 0.6 },
    builtin: true,
    usage: ["floor", "wall"],
  },
  {
    id: "mat_ceramic_white",
    name: "Ceramica blanca",
    category: "ceramic",
    baseColor: "#e8e6e1",
    roughness: 0.25,
    metalness: 0,
    opacity: 1,
    texture: "ceramic-tile",
    bump: 0.4,
    tiling: { x: 0.3, y: 0.3 },
    builtin: true,
    usage: ["wall", "floor"],
  },
  {
    id: "mat_marble_carrara",
    name: "Marmol Carrara",
    category: "marble",
    baseColor: "#e4e4e0",
    roughness: 0.18,
    metalness: 0,
    opacity: 1,
    texture: "marble",
    bump: 0.1,
    tiling: { x: 1.2, y: 1.2 },
    builtin: true,
    usage: ["floor", "wall"],
  },
  {
    id: "mat_marble_black",
    name: "Marmol negro",
    category: "marble",
    baseColor: "#2f3134",
    roughness: 0.16,
    metalness: 0,
    opacity: 1,
    texture: "marble",
    bump: 0.1,
    tiling: { x: 1.2, y: 1.2 },
    builtin: true,
    usage: ["floor"],
  },

  // --- Cubiertas -----------------------------------------------------------
  {
    id: "mat_roof_tile",
    name: "Teja de barro",
    category: "roof-tile",
    baseColor: "#8a3f26",
    roughness: 0.8,
    metalness: 0,
    opacity: 1,
    texture: "roof-shingle",
    bump: 0.9,
    tiling: { x: 0.9, y: 0.6 },
    builtin: true,
    usage: ["roof"],
  },
  {
    id: "mat_roof_slate",
    name: "Teja pizarra",
    category: "roof-tile",
    baseColor: "#4b4f55",
    roughness: 0.75,
    metalness: 0,
    opacity: 1,
    texture: "roof-shingle",
    bump: 0.85,
    tiling: { x: 0.9, y: 0.6 },
    builtin: true,
    usage: ["roof"],
  },
  {
    id: "mat_roof_metal",
    name: "Cubierta metalica",
    category: "metal",
    baseColor: "#6d757c",
    roughness: 0.4,
    metalness: 0.75,
    opacity: 1,
    texture: "roof-metal",
    bump: 0.6,
    tiling: { x: 0.5, y: 2 },
    builtin: true,
    usage: ["roof"],
  },

  // --- Metal, vidrio, textil, exterior -------------------------------------
  {
    id: "mat_metal_brushed",
    name: "Aluminio cepillado",
    category: "metal",
    baseColor: "#b6bbc0",
    roughness: 0.3,
    metalness: 0.9,
    opacity: 1,
    texture: "brushed-metal",
    bump: 0.15,
    tiling: { x: 0.5, y: 0.5 },
    builtin: true,
    usage: ["furniture", "opening"],
  },
  {
    id: "mat_metal_dark",
    name: "Acero negro",
    category: "metal",
    baseColor: "#3a3d40",
    roughness: 0.45,
    metalness: 0.85,
    opacity: 1,
    texture: "brushed-metal",
    bump: 0.12,
    tiling: { x: 0.5, y: 0.5 },
    builtin: true,
    usage: ["furniture", "opening"],
  },
  {
    id: "mat_glass_clear",
    name: "Vidrio claro",
    category: "glass",
    baseColor: "#bcd6e0",
    roughness: 0.05,
    metalness: 0,
    opacity: 0.35,
    texture: "plain",
    bump: 0,
    builtin: true,
    usage: ["opening"],
  },
  {
    id: "mat_glass_tinted",
    name: "Vidrio bronce",
    category: "glass",
    baseColor: "#9d8a6f",
    roughness: 0.08,
    metalness: 0,
    opacity: 0.45,
    texture: "plain",
    bump: 0,
    builtin: true,
    usage: ["opening"],
  },
  {
    id: "mat_fabric_linen",
    name: "Tela lino",
    category: "paint",
    baseColor: "#c9c2b2",
    roughness: 0.95,
    metalness: 0,
    opacity: 1,
    texture: "fabric",
    bump: 0.5,
    tiling: { x: 0.4, y: 0.4 },
    builtin: true,
    usage: ["furniture"],
  },
  {
    id: "mat_grass",
    name: "Cesped",
    category: "paint",
    baseColor: "#4f6b3a",
    roughness: 1,
    metalness: 0,
    opacity: 1,
    texture: "grass",
    bump: 0.7,
    tiling: { x: 1, y: 1 },
    builtin: true,
    usage: ["floor"],
  },
];

export const MATERIAL_CATALOG: readonly CatalogMaterial[] = catalog;

const byId = new Map(catalog.map((material) => [material.id, material]));

export function catalogMaterialById(id: string): CatalogMaterial | undefined {
  return byId.get(id);
}

/** Materiales sugeridos para un tipo de superficie. */
export function materialsForUsage(usage: MaterialUsage): CatalogMaterial[] {
  return catalog.filter((material) => material.usage.includes(usage));
}

/**
 * Copia serializable para insertar en una escena.
 *
 * `usage` es informacion de catalogo, no del documento: se descarta al guardar
 * para que la escena no arrastre campos que el esquema no conoce.
 */
export function toMaterialDefinition(material: CatalogMaterial): MaterialDefinition {
  const { usage: _usage, ...definition } = material;
  return definition;
}

/** Materiales base disponibles en todo proyecto nuevo. */
export function builtinMaterials(): MaterialDefinition[] {
  return catalog.map(toMaterialDefinition);
}

/**
 * Pone al dia los materiales de catalogo de una escena guardada.
 *
 * El catalogo es de la aplicacion, no del proyecto: cuando mejora la
 * definicion de un material (una textura nueva, otra rugosidad), los proyectos
 * existentes deben recibirla sin que el usuario tenga que hacer nada. Se
 * reconoce por identificador, se reemplaza la definicion y se anaden los
 * materiales que aun no estaban.
 *
 * Los materiales creados por el usuario no se tocan jamas.
 */
export function syncCatalogMaterials(materials: readonly MaterialDefinition[]): {
  materials: MaterialDefinition[];
  changed: boolean;
} {
  let changed = false;
  const seen = new Set<string>();

  const updated = materials.map((material) => {
    const catalogEntry = byId.get(material.id);
    if (!catalogEntry) return material;

    seen.add(material.id);
    const fresh = toMaterialDefinition(catalogEntry);
    // Se compara el contenido para no ensuciar el estado de guardado con
    // escenas que en realidad no cambiaron.
    if (JSON.stringify(fresh) !== JSON.stringify(material)) changed = true;
    return fresh;
  });

  for (const entry of catalog) {
    if (seen.has(entry.id)) continue;
    updated.push(toMaterialDefinition(entry));
    changed = true;
  }

  return { materials: updated, changed };
}
