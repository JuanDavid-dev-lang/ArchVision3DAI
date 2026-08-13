import { describe, expect, it } from "vitest";
import { TEXTURE_PATTERNS } from "@archvision/types";
import { patternFunction } from "./patterns";
import { rasterizePattern } from "./textures";
import { fbm, ValueNoise } from "./noise";

describe("ruido", () => {
  it("es determinista para la misma semilla", () => {
    const a = new ValueNoise(8, 8, 42);
    const b = new ValueNoise(8, 8, 42);
    expect(a.sample(1.37, 2.19)).toBe(b.sample(1.37, 2.19));
  });

  it("se repite con el periodo declarado", () => {
    const noise = new ValueNoise(8, 4, 7);
    expect(noise.sample(0.5, 0.25)).toBeCloseTo(noise.sample(8.5, 4.25), 12);
  });

  it("mantiene el resultado en 0..1", () => {
    const field = fbm({ baseFrequency: 4, octaves: 4, persistence: 0.5, seed: 3 });
    for (let i = 0; i < 50; i += 1) {
      const value = field(i / 50, (i * 7) / 50);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("patrones", () => {
  /**
   * La propiedad que sostiene todo el sistema: las texturas se repiten sobre
   * superficies grandes, asi que el borde derecho debe coincidir con el
   * izquierdo y el superior con el inferior. Un patron con costura se nota de
   * inmediato en una fachada.
   */
  it("cierran sin costura en ambos ejes", () => {
    for (const pattern of TEXTURE_PATTERNS) {
      const sample = patternFunction(pattern);

      for (let i = 0; i < 12; i += 1) {
        const t = (i + 0.5) / 12;

        const left = sample(0, t);
        const right = sample(1, t);
        expect(right.shade, `${pattern} en horizontal`).toBeCloseTo(left.shade, 9);
        expect(right.height, `${pattern} en horizontal`).toBeCloseTo(left.height, 9);

        const top = sample(t, 0);
        const bottom = sample(t, 1);
        expect(bottom.shade, `${pattern} en vertical`).toBeCloseTo(top.shade, 9);
        expect(bottom.height, `${pattern} en vertical`).toBeCloseTo(top.height, 9);
      }
    }
  });

  it("producen valores utilizables", () => {
    for (const pattern of TEXTURE_PATTERNS) {
      const sample = patternFunction(pattern);
      for (let i = 0; i < 20; i += 1) {
        const value = sample(i / 20, (i * 3) / 20);
        expect(Number.isFinite(value.shade)).toBe(true);
        expect(value.height).toBeGreaterThanOrEqual(0);
        expect(value.height).toBeLessThanOrEqual(1);
        expect(value.roughness).toBeGreaterThan(0);
      }
    }
  });

  it("tienen contraste salvo el color liso", () => {
    for (const pattern of TEXTURE_PATTERNS) {
      const sample = patternFunction(pattern);
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;

      for (let y = 0; y < 24; y += 1) {
        for (let x = 0; x < 24; x += 1) {
          const value = sample(x / 24, y / 24).shade;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }

      if (pattern === "plain") expect(max - min).toBe(0);
      else expect(max - min, pattern).toBeGreaterThan(0.02);
    }
  });
});

describe("rasterizacion", () => {
  it("genera los tres mapas con el tamano pedido", () => {
    const raster = rasterizePattern("brick", 32);
    expect(raster.size).toBe(32);
    expect(raster.albedo).toHaveLength(32 * 32 * 4);
    expect(raster.normal).toHaveLength(32 * 32 * 4);
    expect(raster.roughness).toHaveLength(32 * 32 * 4);
  });

  it("deja el mapa normal apuntando hacia fuera", () => {
    const raster = rasterizePattern("stucco", 32);
    for (let i = 0; i < raster.normal.length; i += 4) {
      // El canal azul es la componente Z: siempre positiva en espacio tangente.
      expect(raster.normal[i + 2]).toBeGreaterThan(127);
      expect(raster.normal[i + 3]).toBe(255);
    }
  });

  it("codifica el color liso como blanco", () => {
    const raster = rasterizePattern("plain", 8);
    for (let i = 0; i < raster.albedo.length; i += 4) {
      expect(raster.albedo[i]).toBe(255);
    }
  });
});
