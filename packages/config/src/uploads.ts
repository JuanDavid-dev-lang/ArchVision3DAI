/**
 * Politica de archivos aceptados.
 *
 * Se valida extension + MIME declarado + tamano en el servidor antes de
 * generar cualquier URL firmada.
 */
export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_PLAN_MIME = [
  ...ACCEPTED_IMAGE_MIME,
  "application/pdf",
  "image/svg+xml",
] as const;

export const ACCEPTED_MODEL_MIME = [
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream",
] as const;

export const ACCEPTED_MODEL_EXTENSIONS = [
  ".glb",
  ".gltf",
  ".obj",
  ".stl",
  ".fbx",
] as const;

/** Roles de fotografia usados por el pipeline de reconstruccion. */
export const PHOTO_ROLES = [
  "front",
  "back",
  "left",
  "right",
  "roof",
  "interior",
  "detail",
  "other",
] as const;

export type PhotoRole = (typeof PHOTO_ROLES)[number];
