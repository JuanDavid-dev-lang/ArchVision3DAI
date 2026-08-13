/**
 * Tipos primitivos compartidos.
 *
 * REGLA DE UNIDADES: todo valor numerico persistido esta en METROS y en
 * RADIANES. La conversion a la unidad de visualizacion del usuario ocurre
 * unicamente en la capa de presentacion (@archvision/shared/units).
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Rotacion Euler en radianes, orden XYZ. */
export interface Euler3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform {
  position: Vector3;
  rotation: Euler3;
  scale: Vector3;
}

export const ZERO_VECTOR3: Vector3 = { x: 0, y: 0, z: 0 };
export const ONE_VECTOR3: Vector3 = { x: 1, y: 1, z: 1 };

export const IDENTITY_TRANSFORM: Transform = {
  position: ZERO_VECTOR3,
  rotation: ZERO_VECTOR3,
  scale: ONE_VECTOR3,
};

/** Caja alineada a ejes, en metros. */
export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

/** Color hexadecimal en formato "#rrggbb". */
export type HexColor = string;

/** Identificador estable (UUID v4). Nunca usar indices de array como id. */
export type EntityId = string;
