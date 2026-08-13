import {
  BoxGeometry,
  BufferGeometry,
  BufferGeometryUtils,
} from "./three-utils";
import type { Stair } from "@archvision/types";
import { applyBoxUv } from "./uv";

/**
 * Generador parametrico de escaleras.
 *
 * Se construye peldano a peldano en coordenadas locales (origen en el arranque,
 * avance segun +Z) y se fusiona en una sola geometria para no multiplicar los
 * objetos de la escena. Soporta recta, en L, en U y de caracol.
 */

interface StepPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  tread: number;
}

function stepPlacements(stair: Stair): StepPlacement[] {
  const steps = Math.max(2, Math.round(stair.steps));
  const riser = stair.totalRise / steps;
  const tread = stair.tread;
  const width = stair.width;
  const placements: StepPlacement[] = [];

  if (stair.kind === "spiral") {
    const radius = Math.max(0.6, width);
    const turnPerStep = (Math.PI * 1.5) / steps;
    for (let i = 0; i < steps; i += 1) {
      const angle = turnPerStep * i;
      placements.push({
        x: Math.cos(angle) * (radius / 2),
        y: riser * (i + 0.5),
        z: Math.sin(angle) * (radius / 2),
        rotationY: -angle,
        width: radius,
        tread,
      });
    }
    return placements;
  }

  if (stair.kind === "l-shape" || stair.kind === "u-shape") {
    const firstFlight = Math.floor(steps / 2);
    const landingDepth = width;
    const turn = stair.kind === "l-shape" ? Math.PI / 2 : Math.PI;

    for (let i = 0; i < steps; i += 1) {
      if (i < firstFlight) {
        placements.push({
          x: 0,
          y: riser * (i + 0.5),
          z: tread * (i + 0.5),
          rotationY: 0,
          width,
          tread,
        });
        continue;
      }

      const index = i - firstFlight;
      const baseZ = tread * firstFlight + landingDepth;
      if (stair.kind === "l-shape") {
        placements.push({
          x: tread * (index + 0.5),
          y: riser * (i + 0.5),
          z: baseZ - width / 2,
          rotationY: turn,
          width,
          tread,
        });
      } else {
        placements.push({
          x: width,
          y: riser * (i + 0.5),
          z: baseZ - tread * (index + 0.5),
          rotationY: turn,
          width,
          tread,
        });
      }
    }
    return placements;
  }

  for (let i = 0; i < steps; i += 1) {
    placements.push({
      x: 0,
      y: riser * (i + 0.5),
      z: tread * (i + 0.5),
      rotationY: 0,
      width,
      tread,
    });
  }
  return placements;
}

/** Geometria completa de la escalera en coordenadas locales. */
export function createStairGeometry(stair: Stair): BufferGeometry {
  const steps = Math.max(2, Math.round(stair.steps));
  const riser = stair.totalRise / steps;
  const placements = stepPlacements(stair);
  const pieces: BufferGeometry[] = [];

  for (const placement of placements) {
    const step = new BoxGeometry(placement.width, riser, placement.tread);
    if (placement.rotationY !== 0) step.rotateY(placement.rotationY);
    step.translate(placement.x, placement.y, placement.z);
    pieces.push(step);
  }

  if (stair.hasLanding && (stair.kind === "l-shape" || stair.kind === "u-shape")) {
    const firstFlight = Math.floor(steps / 2);
    const landing = new BoxGeometry(stair.width, riser, stair.width);
    landing.translate(
      stair.kind === "u-shape" ? stair.width / 2 : 0,
      riser * (firstFlight + 0.5),
      stair.tread * firstFlight + stair.width / 2,
    );
    pieces.push(landing);
  }

  const merged = BufferGeometryUtils.mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();

  if (!merged) return new BufferGeometry();
  merged.computeVertexNormals();
  applyBoxUv(merged);
  merged.computeBoundingBox();
  return merged;
}

export function stairGeometryKey(stair: Stair): string {
  return [
    stair.id,
    stair.kind,
    stair.steps,
    stair.totalRise.toFixed(3),
    stair.width.toFixed(3),
    stair.tread.toFixed(3),
    stair.hasLanding ? "l" : "-",
  ].join("#");
}
