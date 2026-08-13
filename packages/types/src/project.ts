/**
 * Tipos de dominio de proyecto compartidos entre cliente y servidor.
 *
 * Se mantienen desacoplados de Prisma a proposito: la capa de API traduce
 * modelos de base de datos a estos DTO.
 */

export const PROJECT_TYPES = [
  "house",
  "apartment",
  "building",
  "office",
  "commercial",
  "custom",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  house: "Casa",
  apartment: "Apartamento",
  building: "Edificio",
  office: "Oficina",
  commercial: "Local comercial",
  custom: "Proyecto personalizado",
};

export const UNIT_SYSTEMS = ["m", "cm", "mm", "ft", "in"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const UNIT_LABELS: Record<UnitSystem, string> = {
  m: "Metros",
  cm: "Centimetros",
  mm: "Milimetros",
  ft: "Pies",
  in: "Pulgadas",
};

export const CREATION_METHODS = [
  "photos",
  "floorplan",
  "draw",
  "empty",
] as const;
export type CreationMethod = (typeof CREATION_METHODS)[number];

export const PROJECT_STATUSES = [
  "draft",
  "processing",
  "ready",
  "error",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Borrador",
  processing: "Procesando",
  ready: "Listo",
  error: "Error",
};

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  type: ProjectType;
  units: UnitSystem;
  status: ProjectStatus;
  /** 0..100. Refleja el avance del pipeline de IA cuando aplica. */
  progress: number;
  floorsCount: number;
  areaEstimate: number | null;
  thumbnailUrl: string | null;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  workspaceId: string;
  ownerId: string;
  location: string | null;
  floorHeight: number;
  creationMethod: CreationMethod;
}
