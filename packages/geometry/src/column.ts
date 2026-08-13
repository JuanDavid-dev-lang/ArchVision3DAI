import { BoxGeometry, CylinderGeometry, type BufferGeometry } from "./three-utils";
import type { Column } from "@archvision/types";
import { applyBoxUv } from "./uv";

/** Columnas rectangulares y circulares, con la base en la cota del nivel. */
export function createColumnGeometry(column: Column): BufferGeometry {
  const geometry: BufferGeometry =
    column.shape === "circle"
      ? new CylinderGeometry(column.width / 2, column.width / 2, column.height, 24)
      : new BoxGeometry(column.width, column.height, column.depth);

  geometry.translate(0, column.height / 2, 0);
  applyBoxUv(geometry);
  geometry.computeBoundingBox();
  return geometry;
}

export function columnGeometryKey(column: Column): string {
  return [
    column.id,
    column.shape,
    column.width.toFixed(3),
    column.depth.toFixed(3),
    column.height.toFixed(3),
  ].join("#");
}
