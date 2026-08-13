import { BufferAttribute, type BufferGeometry } from "./three-utils";

/**
 * Proyeccion de coordenadas de textura en metros.
 *
 * Las geometrias arquitectonicas se construyen a mano (paredes extruidas,
 * faldones de cubierta, peldanos) y sus UV por defecto no sirven: unas vienen
 * en el sistema del perfil extruido y otras no vienen. Sin una referencia
 * comun, un mismo material de ladrillo saldria con piezas de tamano distinto
 * en cada superficie.
 *
 * La solucion es proyectar segun la normal dominante de cada cara, tomando
 * como UV las dos coordenadas del plano al que la cara mira. Como el modelo se
 * mide en metros, la UV resultante tambien: una tesela de 0.6 m se configura
 * simplemente con `repeat = 1 / 0.6`.
 */

/**
 * Asigna UV proyectadas en caja al espacio local de la geometria.
 *
 * @param geometry Geometria no indexada o indexada con normales calculadas.
 * @param scale Factor sobre los metros, util para geometrias en otra escala.
 */
export function applyBoxUv(geometry: BufferGeometry, scale = 1): BufferGeometry {
  const position = geometry.getAttribute("position");
  if (!position) return geometry;

  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  if (!normal) return geometry;

  const count = position.count;
  const uv = new Float32Array(count * 2);

  for (let i = 0; i < count; i += 1) {
    const px = position.getX(i);
    const py = position.getY(i);
    const pz = position.getZ(i);

    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    let u: number;
    let v: number;

    if (ny >= nx && ny >= nz) {
      // Cara horizontal (suelo, techo, losa): se mira desde arriba.
      u = px;
      v = pz;
    } else if (nx >= nz) {
      // Cara orientada al eje X: el plano visible es YZ.
      u = pz;
      v = py;
    } else {
      // Cara orientada al eje Z: el plano visible es XY.
      u = px;
      v = py;
    }

    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }

  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  return geometry;
}
