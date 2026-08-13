import type { SceneDocument } from "@archvision/types";

/**
 * Serializacion del documento de escena.
 *
 * REGLA DE PERSISTENCIA: en la base de datos solo entran datos serializables.
 * Nunca objetos de Three.js, geometrias, materiales compilados ni texturas.
 */

export function serializeScene(scene: SceneDocument): string {
  return JSON.stringify(scene);
}

/**
 * Deserializa sin validar. La validacion con Zod ocurre en la capa de API
 * (`sceneDocumentSchema`), para no acoplar la base de datos a la validacion.
 */
export function deserializeScene(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

/** Tamano aproximado en bytes del documento, util para cuotas. */
export function sceneSizeBytes(scene: SceneDocument): number {
  return Buffer.byteLength(serializeScene(scene), "utf8");
}
