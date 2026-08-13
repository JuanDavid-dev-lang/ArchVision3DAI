import { BoxGeometry, BufferGeometry, BufferGeometryUtils } from "./three-utils";
import type { Door, WindowEntity } from "@archvision/types";

/**
 * Carpinteria de puertas y ventanas.
 *
 * Las geometrias se expresan en el sistema local de la pared, centradas en el
 * vano, para poder colgarlas del mismo grupo que la pared.
 */

export interface OpeningPlacement {
  /** Centro del vano en coordenadas locales de la pared. */
  position: [number, number, number];
  width: number;
  height: number;
}

/** Centro del vano de una puerta en coordenadas locales de pared. */
export function doorPlacement(door: Door): OpeningPlacement {
  return {
    position: [door.offset, door.height / 2, 0],
    width: door.width,
    height: door.height,
  };
}

/** Centro del vano de una ventana en coordenadas locales de pared. */
export function windowPlacement(window: WindowEntity): OpeningPlacement {
  return {
    position: [window.offset, window.sillHeight + window.height / 2, 0],
    width: window.width,
    height: window.height,
  };
}

/**
 * Marco perimetral del vano: cuatro piezas que enmarcan el hueco.
 * `depth` suele ser el grosor de la pared para que el marco lo atraviese.
 */
export function createFrameGeometry(
  width: number,
  height: number,
  depth: number,
  thickness: number,
): BufferGeometry {
  const t = Math.min(thickness, Math.min(width, height) / 3);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const pieces: BufferGeometry[] = [];

  const top = new BoxGeometry(width, t, depth);
  top.translate(0, halfHeight - t / 2, 0);
  pieces.push(top);

  const bottom = new BoxGeometry(width, t, depth);
  bottom.translate(0, -halfHeight + t / 2, 0);
  pieces.push(bottom);

  const left = new BoxGeometry(t, height - 2 * t, depth);
  left.translate(-halfWidth + t / 2, 0, 0);
  pieces.push(left);

  const right = new BoxGeometry(t, height - 2 * t, depth);
  right.translate(halfWidth - t / 2, 0, 0);
  pieces.push(right);

  const merged = BufferGeometryUtils.mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();

  if (!merged) return new BoxGeometry(width, height, depth);

  merged.computeVertexNormals();
  return merged;
}

/** Hoja de vidrio del vano, ligeramente mas delgada que la pared. */
export function createGlassGeometry(
  width: number,
  height: number,
  frameThickness: number,
): BufferGeometry {
  const t = Math.min(frameThickness, Math.min(width, height) / 3);
  return new BoxGeometry(
    Math.max(0.02, width - 2 * t),
    Math.max(0.02, height - 2 * t),
    0.012,
  );
}

/** Hoja de puerta, desplazada hacia el lado de apertura. */
export function createDoorLeafGeometry(
  width: number,
  height: number,
  frameThickness = 0.05,
): BufferGeometry {
  const t = Math.min(frameThickness, Math.min(width, height) / 3);
  return new BoxGeometry(
    Math.max(0.05, width - 2 * t),
    Math.max(0.05, height - t),
    0.045,
  );
}
