/**
 * Punto unico de importacion de Three.js dentro del paquete de geometria.
 *
 * Centralizarlo evita que cada modulo importe rutas distintas de los addons y
 * facilita sustituir la implementacion (por ejemplo, para pruebas sin WebGL).
 */
export {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
} from "three";

export * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
