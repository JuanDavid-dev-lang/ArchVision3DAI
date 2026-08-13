import type { BinaryImage, GrayImage } from "./image";

/**
 * Separacion de trazo y papel.
 *
 * Un plano escaneado no tiene un blanco uniforme: hay sombra de escaner,
 * papel amarillento y compresion JPEG. Por eso el umbral se calcula a partir
 * del histograma de cada imagen (Otsu) en lugar de fijar un valor.
 */

/**
 * Umbral de Otsu: el que maximiza la varianza entre las dos clases.
 *
 * Devuelve un nivel de gris; los pixeles por debajo se consideran tinta.
 */
export function otsuThreshold(image: GrayImage): number {
  const histogram = new Uint32Array(256);
  for (const value of image.data) histogram[value] = (histogram[value] ?? 0) + 1;

  const total = image.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * (histogram[i] ?? 0);

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let level = 0; level < 256; level += 1) {
    weightBackground += histogram[level] ?? 0;
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += level * (histogram[level] ?? 0);

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (between > bestVariance) {
      bestVariance = between;
      best = level;
    }
  }

  return best;
}

/**
 * Convierte a mascara binaria. Tinta = 1.
 *
 * @param threshold Nivel de corte; por omision, el de Otsu.
 */
export function binarize(image: GrayImage, threshold?: number): BinaryImage {
  const level = threshold ?? otsuThreshold(image);
  const data = new Uint8Array(image.data.length);

  for (let i = 0; i < data.length; i += 1) {
    data[i] = (image.data[i] ?? 255) <= level ? 1 : 0;
  }

  return { width: image.width, height: image.height, data };
}

/** Proporcion de pixeles marcados. Sirve para descartar imagenes inservibles. */
export function inkRatio(mask: BinaryImage): number {
  let count = 0;
  for (const value of mask.data) count += value;
  return count / mask.data.length;
}
