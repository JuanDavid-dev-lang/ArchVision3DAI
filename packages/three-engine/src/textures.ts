import {
  DataTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import type { TexturePattern } from "@archvision/types";
import { clamp01 } from "./noise";
import { patternFunction } from "./patterns";

/**
 * Sintesis de texturas.
 *
 * El patron se rasteriza a tres mapas (color, normal y rugosidad) y se sube a
 * la GPU como `DataTexture`. Se usa `DataTexture` y no `CanvasTexture` porque
 * no depende del DOM: la misma funcion sirve en el navegador, en pruebas y en
 * un futuro renderizador de servidor.
 *
 * Las texturas se generan una vez por patron y se comparten entre todos los
 * materiales que lo usan: el tinte lo pone el color del material, no la imagen.
 */

export const TEXTURE_SIZE = 512;

export interface PatternRaster {
  size: number;
  /** RGBA, sRGB. Tono neutro que multiplica al color base del material. */
  albedo: Uint8Array;
  /** RGBA tangencial. Lineal. */
  normal: Uint8Array;
  /** RGBA con la rugosidad en el canal verde. Lineal. */
  roughness: Uint8Array;
}

/**
 * Rasteriza un patron. Funcion pura, sin dependencias de navegador.
 *
 * El mapa normal se deriva del relieve con un operador Sobel envolvente: al
 * leer los vecinos con modulo, los bordes opuestos coinciden y la textura
 * repite sin costura visible.
 */
export function rasterizePattern(
  pattern: TexturePattern,
  size: number = TEXTURE_SIZE,
): PatternRaster {
  const sample = patternFunction(pattern);
  const pixels = size * size;

  const height = new Float32Array(pixels);
  const albedo = new Uint8Array(pixels * 4);
  const roughness = new Uint8Array(pixels * 4);
  const normal = new Uint8Array(pixels * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const value = sample((x + 0.5) / size, (y + 0.5) / size);

      height[index] = clamp01(value.height);

      // Blanco significa "sin cambio": el shader multiplica el color base por
      // la textura, de modo que 1 deja el material en su color nominal y los
      // valores por debajo lo oscurecen (juntas, sombras, vetas).
      const shade = Math.round(clamp01(value.shade) * 255);
      const offset = index * 4;
      albedo[offset] = shade;
      albedo[offset + 1] = shade;
      albedo[offset + 2] = shade;
      albedo[offset + 3] = 255;

      const rough = Math.round(clamp01(value.roughness) * 255);
      roughness[offset] = 0;
      roughness[offset + 1] = rough;
      roughness[offset + 2] = 0;
      roughness[offset + 3] = 255;
    }
  }

  const at = (x: number, y: number): number => {
    const cx = ((x % size) + size) % size;
    const cy = ((y % size) + size) % size;
    return height[cy * size + cx] ?? 0;
  };

  // Intensidad del relieve en la propia imagen. Se mantiene baja a proposito:
  // el operador Sobel ya amplifica los saltos bruscos (juntas, cantos de teja)
  // y un valor alto tumba tambien las zonas lisas, que acaban devolviendo la
  // luz de lado y oscureciendo toda la superficie. El ajuste por material se
  // hace con `normalScale`, que no obliga a regenerar la textura.
  const strength = 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));

      const nx = dx * strength;
      const ny = dy * strength;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;

      const offset = (y * size + x) * 4;
      normal[offset] = Math.round((nx / length) * 0.5 * 255 + 127.5);
      normal[offset + 1] = Math.round((ny / length) * 0.5 * 255 + 127.5);
      normal[offset + 2] = Math.round((nz / length) * 0.5 * 255 + 127.5);
      normal[offset + 3] = 255;
    }
  }

  return { size, albedo, normal, roughness };
}

export interface PatternTextures {
  map: DataTexture;
  normalMap: DataTexture;
  roughnessMap: DataTexture;
}

function toTexture(data: Uint8Array, size: number, srgb: boolean): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

const textureCache = new Map<string, PatternTextures>();

/** Texturas de GPU del patron, generadas una sola vez y compartidas. */
export function patternTextures(
  pattern: TexturePattern,
  size: number = TEXTURE_SIZE,
): PatternTextures {
  const key = `${pattern}@${size}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const raster = rasterizePattern(pattern, size);
  const textures: PatternTextures = {
    map: toTexture(raster.albedo, size, true),
    normalMap: toTexture(raster.normal, size, false),
    roughnessMap: toTexture(raster.roughness, size, false),
  };

  textureCache.set(key, textures);
  return textures;
}

/** Libera las texturas generadas. Solo al desmontar el editor. */
export function disposePatternTextures(): void {
  for (const set of textureCache.values()) {
    set.map.dispose();
    set.normalMap.dispose();
    set.roughnessMap.dispose();
  }
  textureCache.clear();
}
