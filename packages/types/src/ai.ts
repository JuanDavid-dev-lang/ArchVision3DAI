import type { Vector2 } from "./primitives";

/**
 * Contratos del servicio de vision por computador.
 *
 * Estos tipos se definen ya en Fase 1 para que el resto del sistema pueda
 * compilarse contra ellos mientras el servicio real (Fase 6) usa respuestas
 * simuladas.
 */

export const AI_JOB_STAGES = [
  "uploading",
  "normalizing",
  "detecting",
  "segmenting",
  "depth",
  "geometry",
  "materials",
  "done",
] as const;
export type AIJobStage = (typeof AI_JOB_STAGES)[number];

export const AI_JOB_STAGE_LABELS: Record<AIJobStage, string> = {
  uploading: "Subiendo imagenes",
  normalizing: "Normalizando imagenes",
  detecting: "Detectando arquitectura",
  segmenting: "Segmentando materiales",
  depth: "Estimando profundidad",
  geometry: "Generando geometria",
  materials: "Aplicando materiales",
  done: "Completado",
};

export type AIJobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface AIJobProgress {
  stage: AIJobStage;
  /** 0..100 dentro de la etapa actual. */
  percent: number;
}

export interface AIJob {
  id: string;
  projectId: string;
  status: AIJobStatus;
  /** 0..100 global. */
  progress: number;
  stages: AIJobProgress[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const DETECTION_CLASSES = [
  "wall",
  "window",
  "door",
  "roof",
  "balcony",
  "column",
  "stair",
  "floor",
  "ceiling",
  "furniture",
  "sky",
  "vegetation",
] as const;
export type DetectionClass = (typeof DETECTION_CLASSES)[number];

/** Caja normalizada [0..1] respecto al tamano de la imagen. */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  class: DetectionClass;
  box: NormalizedBox;
  /** 0..1 */
  confidence: number;
  /** Poligono opcional de segmentacion, coordenadas normalizadas. */
  polygon?: Vector2[];
  /** true cuando el usuario ya la reviso o corrigio. */
  reviewed?: boolean;
}

export interface ImageAnalysisResult {
  fileId: string;
  width: number;
  height: number;
  detections: Detection[];
  /** Escala estimada metros/pixel, si hubo calibracion. */
  metersPerPixel?: number;
  notes?: string[];
}

/** Referencia de calibracion: dos puntos en la imagen y su medida real. */
export interface CalibrationReference {
  id: string;
  fileId: string;
  a: Vector2;
  b: Vector2;
  /** Longitud real en metros. */
  realLength: number;
  label?: string;
}

export type AccuracyLevel = "high" | "medium" | "low";

export interface AccuracyEstimate {
  level: AccuracyLevel;
  /** Error relativo estimado, por ejemplo 0.08 = +/-8%. */
  relativeError: number;
  reasons: string[];
}

/** Umbrales de color para mostrar confianza en la UI. */
export const CONFIDENCE_THRESHOLDS = { high: 0.8, medium: 0.5 } as const;

export function confidenceLevel(value: number): AccuracyLevel {
  if (value >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (value >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}
