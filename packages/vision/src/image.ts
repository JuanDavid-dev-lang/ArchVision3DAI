/**
 * Imagen en memoria, sin dependencias de navegador.
 *
 * El pipeline de deteccion trabaja sobre estructuras planas para poder
 * ejecutarse igual en el navegador (a partir de un `ImageData`), en pruebas y,
 * mas adelante, en el servicio Python. Ninguna funcion de este paquete toca el
 * DOM ni Three.js.
 */

/** Compatible en forma con `ImageData` del navegador. */
export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA de 8 bits, longitud `width * height * 4`. */
  data: Uint8ClampedArray;
}

/** Imagen de un solo canal, 0 a 255. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Mascara binaria: 1 marca tinta (trazo del plano), 0 fondo. */
export interface BinaryImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function createGray(width: number, height: number): GrayImage {
  return { width, height, data: new Uint8Array(width * height) };
}

/**
 * Luminancia perceptual.
 *
 * Los planos suelen ser negro sobre blanco, pero los escaneados traen tramas
 * de color y sellos; una conversion ponderada conserva mejor el trazo que la
 * media aritmetica de los canales.
 */
export function toGrayscale(image: RgbaImage): GrayImage {
  const gray = createGray(image.width, image.height);

  for (let i = 0, p = 0; i < gray.data.length; i += 1, p += 4) {
    const r = image.data[p] ?? 0;
    const g = image.data[p + 1] ?? 0;
    const b = image.data[p + 2] ?? 0;
    const alpha = (image.data[p + 3] ?? 255) / 255;

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Lo transparente cuenta como papel: un PNG recortado no debe aparecer
    // como una mancha de tinta enorme.
    gray.data[i] = Math.round(luma * alpha + 255 * (1 - alpha));
  }

  return gray;
}

/**
 * Reduccion por promediado de bloques.
 *
 * Antes de detectar se baja la resolucion: la transformada de Hough crece con
 * el numero de pixeles y un plano de 4000 px no aporta mas lineas que uno de
 * 1200, solo mas tiempo. El promediado (y no el muestreo) evita que un trazo
 * fino de un pixel desaparezca.
 */
export function downscale(image: GrayImage, maxSide: number): {
  image: GrayImage;
  scale: number;
} {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxSide) return { image, scale: 1 };

  const scale = maxSide / longest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const result = createGray(width, height);

  const stepX = image.width / width;
  const stepY = image.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * stepY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY));

    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * stepX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * stepX));

      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1 && sy < image.height; sy += 1) {
        for (let sx = x0; sx < x1 && sx < image.width; sx += 1) {
          sum += image.data[sy * image.width + sx] ?? 0;
          count += 1;
        }
      }

      result.data[y * width + x] = count > 0 ? Math.round(sum / count) : 255;
    }
  }

  return { image: result, scale: width / image.width };
}

/** Valor del pixel, o `fallback` fuera de la imagen. */
export function pixelAt(image: GrayImage, x: number, y: number, fallback = 255): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return fallback;
  return image.data[y * image.width + x] ?? fallback;
}

export function isInk(mask: BinaryImage, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  return (mask.data[y * mask.width + x] ?? 0) === 1;
}
