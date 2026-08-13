/**
 * Limites por plan SaaS.
 *
 * Se evaluan SIEMPRE en el servidor (nunca confiar en el cliente).
 * Aun sin sistema de pagos, la arquitectura ya respeta estos topes.
 */
export type PlanId = "free" | "pro" | "studio" | "enterprise";

export interface PlanLimits {
  readonly id: PlanId;
  readonly label: string;
  /** Numero maximo de proyectos activos. -1 = ilimitado. */
  readonly maxProjects: number;
  /** Almacenamiento total en bytes. */
  readonly maxStorageBytes: number;
  /** Tamano maximo por archivo subido, en bytes. */
  readonly maxUploadBytes: number;
  /** Analisis de IA por mes. */
  readonly aiAnalysesPerMonth: number;
  /** Renders de alta calidad por mes. */
  readonly rendersPerMonth: number;
  /** Lado mayor maximo de un render, en pixeles. */
  readonly maxRenderResolution: number;
  /** Numero de versiones (snapshots) guardadas por proyecto. */
  readonly maxVersionsPerProject: number;
  /** Miembros por workspace. */
  readonly maxWorkspaceMembers: number;
  /** Formatos de exportacion habilitados. */
  readonly exportFormats: readonly string[];
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    maxProjects: 3,
    maxStorageBytes: 500 * MB,
    maxUploadBytes: 15 * MB,
    aiAnalysesPerMonth: 5,
    rendersPerMonth: 10,
    maxRenderResolution: 1920,
    maxVersionsPerProject: 5,
    maxWorkspaceMembers: 1,
    exportFormats: ["json", "glb", "png"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    maxProjects: 50,
    maxStorageBytes: 20 * GB,
    maxUploadBytes: 50 * MB,
    aiAnalysesPerMonth: 100,
    rendersPerMonth: 300,
    maxRenderResolution: 2560,
    maxVersionsPerProject: 50,
    maxWorkspaceMembers: 3,
    exportFormats: ["json", "glb", "gltf", "obj", "stl", "png", "jpg", "pdf"],
  },
  studio: {
    id: "studio",
    label: "Studio",
    maxProjects: 300,
    maxStorageBytes: 200 * GB,
    maxUploadBytes: 200 * MB,
    aiAnalysesPerMonth: 1000,
    rendersPerMonth: 3000,
    maxRenderResolution: 3840,
    maxVersionsPerProject: 200,
    maxWorkspaceMembers: 15,
    exportFormats: ["json", "glb", "gltf", "obj", "stl", "png", "jpg", "pdf"],
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    maxProjects: -1,
    maxStorageBytes: -1,
    maxUploadBytes: 1024 * MB,
    aiAnalysesPerMonth: -1,
    rendersPerMonth: -1,
    maxRenderResolution: 7680,
    maxVersionsPerProject: -1,
    maxWorkspaceMembers: -1,
    exportFormats: ["json", "glb", "gltf", "obj", "stl", "png", "jpg", "pdf"],
  },
};

export const DEFAULT_PLAN: PlanId = "free";

/** true si `value` respeta el limite (-1 significa ilimitado). */
export function withinLimit(value: number, limit: number): boolean {
  return limit < 0 || value <= limit;
}

export function planLimits(plan: PlanId | string | null | undefined): PlanLimits {
  if (plan && plan in PLANS) return PLANS[plan as PlanId];
  return PLANS[DEFAULT_PLAN];
}
