import { describe, expect, it } from "vitest";
import {
  convert,
  formatLength,
  fromMeters,
  parseLengthInput,
  snapTo,
  toMeters,
} from "./units";
import { polygonArea, polygonPerimeter, projectOnSegment } from "./geometry2d";

describe("units", () => {
  it("convierte a metros desde cada sistema", () => {
    expect(toMeters(1, "m")).toBe(1);
    expect(toMeters(250, "cm")).toBeCloseTo(2.5, 10);
    expect(toMeters(1500, "mm")).toBeCloseTo(1.5, 10);
    expect(toMeters(1, "ft")).toBeCloseTo(0.3048, 10);
    expect(toMeters(12, "in")).toBeCloseTo(0.3048, 10);
  });

  it("es reversible", () => {
    for (const unit of ["m", "cm", "mm", "ft", "in"] as const) {
      expect(fromMeters(toMeters(3.7, unit), unit)).toBeCloseTo(3.7, 10);
    }
  });

  it("convierte entre unidades arbitrarias", () => {
    expect(convert(100, "cm", "m")).toBeCloseTo(1, 10);
    expect(convert(1, "ft", "in")).toBeCloseTo(12, 10);
  });

  it("formatea con sufijo y precision por unidad", () => {
    expect(formatLength(2.5, "m")).toBe("2.50 m");
    expect(formatLength(2.5, "cm")).toBe("250.0 cm");
    expect(formatLength(2.5, "mm")).toBe("2500 mm");
  });

  it("interpreta entradas del usuario", () => {
    expect(parseLengthInput("3,5", "m")).toBeCloseTo(3.5, 10);
    expect(parseLengthInput("350cm", "m")).toBeCloseTo(3.5, 10);
    expect(parseLengthInput("90", "cm")).toBeCloseTo(0.9, 10);
    expect(parseLengthInput('12"', "m")).toBeCloseTo(0.3048, 10);
    expect(parseLengthInput("abc", "m")).toBeNull();
    expect(parseLengthInput("", "m")).toBeNull();
  });

  it("ajusta a la cuadricula", () => {
    expect(snapTo(1.234, 0.1)).toBeCloseTo(1.2, 10);
    expect(snapTo(1.26, 0.1)).toBeCloseTo(1.3, 10);
    expect(snapTo(1.26, 0)).toBe(1.26);
  });
});

describe("geometry2d", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  it("calcula area y perimetro", () => {
    expect(polygonArea(square)).toBeCloseTo(12, 10);
    expect(polygonPerimeter(square)).toBeCloseTo(14, 10);
  });

  it("proyecta un punto sobre un segmento", () => {
    const result = projectOnSegment(
      { x: 2, y: 1 },
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    );
    expect(result.distanceAlong).toBeCloseTo(2, 10);
    expect(result.distanceTo).toBeCloseTo(1, 10);
  });

  it("limita la proyeccion a los extremos del segmento", () => {
    const result = projectOnSegment(
      { x: 9, y: 0 },
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    );
    expect(result.t).toBe(1);
    expect(result.distanceAlong).toBeCloseTo(4, 10);
  });
});
