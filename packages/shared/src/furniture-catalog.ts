/**
 * Catalogo de mobiliario.
 *
 * Hasta la fase 4 no hay modelos GLB: cada pieza se representa con su caja de
 * dimensiones reales, que ya permite estudiar distribucion y circulaciones.
 * Cuando lleguen los modelos, `modelUrl` se rellena y el visor sustituye la
 * caja sin cambiar las instancias guardadas en la escena.
 */

export type FurnitureCategory =
  | "living"
  | "kitchen"
  | "dining"
  | "bedroom"
  | "bathroom"
  | "office"
  | "outdoor"
  | "lighting"
  | "decor"
  | "appliance";

export const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  living: "Sala",
  kitchen: "Cocina",
  dining: "Comedor",
  bedroom: "Dormitorio",
  bathroom: "Bano",
  office: "Oficina",
  outdoor: "Exterior",
  lighting: "Iluminacion",
  decor: "Decoracion",
  appliance: "Electrodomesticos",
};

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  /** Dimensiones en metros: ancho (X), alto (Y), fondo (Z). */
  size: { x: number; y: number; z: number };
  color: string;
  /** Si el objeto se apoya en una pared, el visor lo orienta hacia el interior. */
  wallMounted?: boolean;
  modelUrl?: string;
}

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  { id: "sofa-3-seat", name: "Sofa 3 puestos", category: "living", size: { x: 2.1, y: 0.85, z: 0.9 }, color: "#5d6b7a" },
  { id: "sofa-2-seat", name: "Sofa 2 puestos", category: "living", size: { x: 1.5, y: 0.85, z: 0.9 }, color: "#5d6b7a" },
  { id: "armchair", name: "Poltrona", category: "living", size: { x: 0.85, y: 0.85, z: 0.85 }, color: "#6b7280" },
  { id: "coffee-table", name: "Mesa de centro", category: "living", size: { x: 1.1, y: 0.42, z: 0.6 }, color: "#8a6a45" },
  { id: "tv-unit", name: "Mueble de TV", category: "living", size: { x: 1.8, y: 0.5, z: 0.4 }, color: "#3f4650" },

  { id: "kitchen-counter", name: "Meson de cocina", category: "kitchen", size: { x: 2.4, y: 0.9, z: 0.6 }, color: "#9aa1a8", wallMounted: true },
  { id: "kitchen-island", name: "Isla de cocina", category: "kitchen", size: { x: 1.8, y: 0.9, z: 0.9 }, color: "#9aa1a8" },
  { id: "fridge", name: "Nevera", category: "appliance", size: { x: 0.7, y: 1.8, z: 0.7 }, color: "#c3c8cd", wallMounted: true },
  { id: "stove", name: "Estufa", category: "appliance", size: { x: 0.6, y: 0.9, z: 0.6 }, color: "#2f353d", wallMounted: true },

  { id: "dining-table-6", name: "Comedor 6 puestos", category: "dining", size: { x: 1.8, y: 0.75, z: 0.9 }, color: "#8a6a45" },
  { id: "dining-table-4", name: "Comedor 4 puestos", category: "dining", size: { x: 1.2, y: 0.75, z: 0.8 }, color: "#8a6a45" },
  { id: "chair", name: "Silla", category: "dining", size: { x: 0.45, y: 0.9, z: 0.5 }, color: "#7b6244" },

  { id: "bed-queen", name: "Cama queen", category: "bedroom", size: { x: 1.6, y: 0.55, z: 2.0 }, color: "#6f7683" },
  { id: "bed-double", name: "Cama doble", category: "bedroom", size: { x: 1.4, y: 0.55, z: 1.9 }, color: "#6f7683" },
  { id: "bed-single", name: "Cama sencilla", category: "bedroom", size: { x: 1.0, y: 0.55, z: 1.9 }, color: "#6f7683" },
  { id: "nightstand", name: "Mesa de noche", category: "bedroom", size: { x: 0.45, y: 0.55, z: 0.4 }, color: "#8a6a45" },
  { id: "wardrobe", name: "Closet", category: "bedroom", size: { x: 1.8, y: 2.2, z: 0.6 }, color: "#7d6547", wallMounted: true },

  { id: "toilet", name: "Sanitario", category: "bathroom", size: { x: 0.4, y: 0.8, z: 0.65 }, color: "#e8ecef", wallMounted: true },
  { id: "sink", name: "Lavamanos", category: "bathroom", size: { x: 0.6, y: 0.85, z: 0.45 }, color: "#e8ecef", wallMounted: true },
  { id: "shower", name: "Ducha", category: "bathroom", size: { x: 0.9, y: 2.0, z: 0.9 }, color: "#b7cdd6", wallMounted: true },

  { id: "desk", name: "Escritorio", category: "office", size: { x: 1.4, y: 0.75, z: 0.7 }, color: "#8a6a45", wallMounted: true },
  { id: "office-chair", name: "Silla de oficina", category: "office", size: { x: 0.6, y: 1.1, z: 0.6 }, color: "#33383f" },
  { id: "bookshelf", name: "Biblioteca", category: "office", size: { x: 1.0, y: 1.9, z: 0.35 }, color: "#7d6547", wallMounted: true },

  { id: "planter", name: "Matera", category: "decor", size: { x: 0.5, y: 0.9, z: 0.5 }, color: "#4b6b3f" },
  { id: "rug", name: "Tapete", category: "decor", size: { x: 2.0, y: 0.02, z: 1.4 }, color: "#8b5c4b" },
  { id: "outdoor-table", name: "Mesa exterior", category: "outdoor", size: { x: 1.2, y: 0.75, z: 1.2 }, color: "#6d6a63" },
  { id: "pendant-lamp", name: "Lampara colgante", category: "lighting", size: { x: 0.4, y: 0.4, z: 0.4 }, color: "#d8c9a3" },
];

const BY_ID = new Map(FURNITURE_CATALOG.map((item) => [item.id, item]));

export function furnitureById(catalogId: string): FurnitureCatalogItem | undefined {
  return BY_ID.get(catalogId);
}

/** Caja por defecto para catalogos desconocidos (importaciones antiguas). */
export const FURNITURE_FALLBACK: FurnitureCatalogItem = {
  id: "unknown",
  name: "Objeto",
  category: "decor",
  size: { x: 0.6, y: 0.6, z: 0.6 },
  color: "#8b8f96",
};
