"use client";

import { rasterizePattern } from "@archvision/three-engine";
import type { MaterialDefinition, TexturePattern } from "@archvision/types";

/**
 * Miniaturas de material para la biblioteca.
 *
 * Se reutiliza el mismo generador de patrones que usa el visor: la muestra que
 * ve el usuario en la lista es literalmente la textura que recibira el modelo,
 * no una imagen aparte que pueda quedar desactualizada.
 *
 * Se rasteriza a 96 pixeles y no a 512: la miniatura se ve igual y evita
 * bloquear el hilo principal al abrir el panel con treinta materiales.
 */

const PREVIEW_SIZE = 96;

const rasterCache = new Map<TexturePattern, Uint8Array>();
const urlCache = new Map<string, string>();

function shadeRaster(pattern: TexturePattern): Uint8Array {
  const cached = rasterCache.get(pattern);
  if (cached) return cached;
  const raster = rasterizePattern(pattern, PREVIEW_SIZE);
  rasterCache.set(pattern, raster.albedo);
  return raster.albedo;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return [200, 200, 200];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/**
 * PNG en data URL con el patron tenido del color del material.
 *
 * Devuelve null fuera del navegador o si el canvas no esta disponible; quien
 * la llama debe caer entonces en un simple cuadro de color.
 */
export function materialPreviewUrl(material: MaterialDefinition): string | null {
  if (typeof document === "undefined") return null;

  const pattern = material.texture ?? "plain";
  const key = `${pattern}|${material.baseColor}|${material.opacity}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const [r, g, b] = parseHex(material.baseColor);
  const image = context.createImageData(PREVIEW_SIZE, PREVIEW_SIZE);

  if (pattern === "plain") {
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  } else {
    const albedo = shadeRaster(pattern);
    for (let i = 0; i < image.data.length; i += 4) {
      // El canal rojo basta: la textura es acromatica y solo modula el brillo.
      const shade = (albedo[i] ?? 255) / 255;
      image.data[i] = Math.round(r * shade);
      image.data[i + 1] = Math.round(g * shade);
      image.data[i + 2] = Math.round(b * shade);
      image.data[i + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  const url = canvas.toDataURL("image/png");
  urlCache.set(key, url);
  return url;
}
