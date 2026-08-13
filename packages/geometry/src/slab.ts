import { ExtrudeGeometry, Shape, type BufferGeometry } from "three";
import type { Slab, Vector2 } from "@archvision/types";
import { applyBoxUv } from "./uv";

/**
 * Losas y pisos.
 *
 * El contorno se define en el plano de planta (x, y). La forma se extruye en
 * su plano local y despues se acuesta: `rotateX(+90)` lleva la `y` del plano a
 * la `z` del mundo sin espejar la planta, y la traslacion deja el espesor
 * creciendo hacia arriba desde la cota del nivel.
 */

export function outlineToShape(outline: readonly Vector2[]): Shape {
  const shape = new Shape();
  const first = outline[0];
  if (!first) return shape;

  shape.moveTo(first.x, first.y);
  for (let i = 1; i < outline.length; i += 1) {
    const point = outline[i];
    if (!point) continue;
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  return shape;
}

/** Geometria horizontal a partir de un contorno y un espesor. */
export function createFloorGeometry(
  outline: readonly Vector2[],
  thickness: number,
): BufferGeometry {
  const shape = outlineToShape(outline);
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });

  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness, 0);
  geometry.computeVertexNormals();
  applyBoxUv(geometry);
  geometry.computeBoundingBox();
  return geometry;
}

export function createSlabGeometry(slab: Slab): BufferGeometry {
  return createFloorGeometry(slab.outline, slab.thickness);
}

export function slabGeometryKey(slab: Slab): string {
  const outline = slab.outline
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .join(";");
  return `${slab.id}#${slab.thickness.toFixed(3)}#${outline}`;
}
