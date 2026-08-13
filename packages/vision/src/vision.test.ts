import { describe, expect, it } from "vitest";
import { toGrayscale, type RgbaImage } from "./image";
import { binarize, otsuThreshold } from "./threshold";
import { labelComponents, removeSmallComponents } from "./components";
import { detectWalls, pixelsPerMeterFrom } from "./plan";

/**
 * Las pruebas dibujan planos sinteticos en memoria. Es la unica forma de
 * comprobar el detector sin depender de una imagen binaria en el repositorio,
 * y ademas permite conocer la respuesta correcta al milimetro.
 */

interface Canvas {
  image: RgbaImage;
  fillRect: (x: number, y: number, width: number, height: number) => void;
}

function createCanvas(width: number, height: number): Canvas {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const image: RgbaImage = { width, height, data };

  return {
    image,
    fillRect: (x, y, rectWidth, rectHeight) => {
      for (let py = Math.round(y); py < Math.round(y + rectHeight); py += 1) {
        if (py < 0 || py >= height) continue;
        for (let px = Math.round(x); px < Math.round(x + rectWidth); px += 1) {
          if (px < 0 || px >= width) continue;
          const offset = (py * width + px) * 4;
          data[offset] = 20;
          data[offset + 1] = 20;
          data[offset + 2] = 20;
          data[offset + 3] = 255;
        }
      }
    },
  };
}

/** Rectangulo hueco de 8x6 m con muros de 20 cm, a 50 px/m. */
function rectangularPlan(): RgbaImage {
  const ppm = 50;
  const canvas = createCanvas(8 * ppm + 100, 6 * ppm + 100);
  const wall = 0.2 * ppm;
  const x0 = 50;
  const y0 = 50;
  const width = 8 * ppm;
  const height = 6 * ppm;

  canvas.fillRect(x0, y0, width, wall);
  canvas.fillRect(x0, y0 + height - wall, width, wall);
  canvas.fillRect(x0, y0, wall, height);
  canvas.fillRect(x0 + width - wall, y0, wall, height);

  return canvas.image;
}

describe("umbral", () => {
  it("separa trazo y papel", () => {
    const image = rectangularPlan();
    const gray = toGrayscale(image);
    const threshold = otsuThreshold(gray);

    // El corte cae sobre el nivel del trazo: `binarize` cuenta como tinta el
    // propio umbral.
    expect(threshold).toBeGreaterThanOrEqual(20);
    expect(threshold).toBeLessThan(255);

    const mask = binarize(gray, threshold);
    const ink = mask.data.reduce((sum, value) => sum + value, 0);
    expect(ink).toBeGreaterThan(0);
    expect(ink).toBeLessThan(mask.data.length / 2);
  });

  it("trata lo transparente como papel", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]);
    const gray = toGrayscale({ width: 2, height: 1, data });
    expect(gray.data[0]).toBe(255);
    expect(gray.data[1]).toBe(0);
  });
});

describe("componentes", () => {
  it("cuenta las manchas separadas", () => {
    const canvas = createCanvas(60, 40);
    canvas.fillRect(5, 5, 10, 10);
    canvas.fillRect(40, 20, 6, 6);

    const mask = binarize(toGrayscale(canvas.image));
    const { components } = labelComponents(mask);
    expect(components).toHaveLength(2);
  });

  it("descarta el texto y conserva los muros", () => {
    const canvas = createCanvas(200, 120);
    // Muro largo.
    canvas.fillRect(10, 50, 180, 4);
    // "Texto": manchas pequenas sueltas.
    canvas.fillRect(30, 80, 4, 5);
    canvas.fillRect(40, 80, 4, 5);
    canvas.fillRect(50, 80, 3, 5);

    const mask = binarize(toGrayscale(canvas.image));
    const cleaned = removeSmallComponents(mask, 20);

    const before = mask.data.reduce((sum, value) => sum + value, 0);
    const after = cleaned.data.reduce((sum, value) => sum + value, 0);

    expect(after).toBeLessThan(before);
    // El muro sobrevive entero.
    expect(after).toBeGreaterThanOrEqual(180 * 4 * 0.9);
  });
});

describe("calibracion", () => {
  it("calcula pixeles por metro", () => {
    const ppm = pixelsPerMeterFrom({ x: 0, y: 0 }, { x: 300, y: 400 }, 5);
    expect(ppm).toBeCloseTo(100, 6);
  });

  it("rechaza datos imposibles", () => {
    expect(() => pixelsPerMeterFrom({ x: 1, y: 1 }, { x: 1, y: 1 }, 3)).toThrow();
    expect(() => pixelsPerMeterFrom({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toThrow();
  });
});

describe("deteccion de muros", () => {
  it("encuentra los cuatro muros de una planta rectangular", () => {
    const report = detectWalls(rectangularPlan(), { pixelsPerMeter: 50 });

    expect(report.walls.length).toBeGreaterThanOrEqual(4);
    expect(report.walls.length).toBeLessThanOrEqual(8);

    const horizontal = report.walls.filter(
      (wall) => Math.abs(wall.end.y - wall.start.y) < 1e-6,
    );
    const vertical = report.walls.filter(
      (wall) => Math.abs(wall.end.x - wall.start.x) < 1e-6,
    );

    expect(horizontal.length).toBeGreaterThanOrEqual(2);
    expect(vertical.length).toBeGreaterThanOrEqual(2);

    // Las esquinas deben cerrar: cada extremo coincide con el de otro muro.
    const corners = new Map<string, number>();
    for (const wall of report.walls) {
      for (const point of [wall.start, wall.end]) {
        const key = `${point.x.toFixed(4)}:${point.y.toFixed(4)}`;
        corners.set(key, (corners.get(key) ?? 0) + 1);
      }
    }
    for (const count of corners.values()) expect(count).toBeGreaterThanOrEqual(2);

    // Los muros largos deben acercarse a las medidas reales del dibujo.
    const longest = [...report.walls].sort((a, b) => b.length - a.length)[0]!;
    expect(longest.length).toBeGreaterThan(7.3);
    expect(longest.length).toBeLessThan(8.3);

    for (const wall of report.walls) {
      expect(wall.thickness).toBeGreaterThan(0.05);
      expect(wall.thickness).toBeLessThanOrEqual(0.6);
      expect(wall.confidence).toBeGreaterThan(0.3);
    }
  });

  it("detecta la orientacion de un plano girado", () => {
    const ppm = 40;
    const canvas = createCanvas(600, 500);
    const angle = (8 * Math.PI) / 180;

    // Dos muros paralelos girados 8 grados, dibujados punto a punto.
    for (const offset of [0, 120]) {
      for (let t = 0; t < 380; t += 1) {
        const x = 90 + Math.cos(angle) * t - Math.sin(angle) * offset;
        const y = 120 + Math.sin(angle) * t + Math.cos(angle) * offset;
        canvas.fillRect(x, y, 4, 4);
      }
    }

    const report = detectWalls(canvas.image, { pixelsPerMeter: ppm });
    const detected = report.dominantAngleDeg;

    // El angulo dominante es el de la normal, perpendicular al trazo.
    const normalized = ((detected % 90) + 90) % 90;
    expect(Math.min(Math.abs(normalized - 8), Math.abs(normalized - 98 + 90))).toBeLessThan(
      4,
    );
    expect(report.walls.length).toBeGreaterThanOrEqual(2);
  });

  it("exige calibracion", () => {
    expect(() => detectWalls(rectangularPlan(), { pixelsPerMeter: 0 })).toThrow();
  });

  it("no inventa muros en una hoja en blanco", () => {
    const canvas = createCanvas(300, 300);
    const report = detectWalls(canvas.image, { pixelsPerMeter: 50 });
    expect(report.walls).toHaveLength(0);
  });
});
