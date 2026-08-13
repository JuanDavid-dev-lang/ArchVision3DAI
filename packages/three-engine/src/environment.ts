import type { SceneEnvironment } from "@archvision/types";

/**
 * Ambientes de iluminacion.
 *
 * Cada preset define color de cielo, intensidad y direccion del sol. Los HDRI
 * llegan en la fase 9; el contrato de esta funcion no cambiara al sustituir
 * los valores por mapas de entorno reales.
 */

export interface EnvironmentPreset {
  skyColor: string;
  groundColor: string;
  sunColor: string;
  sunIntensity: number;
  ambientIntensity: number;
  /** Direccion del sol normalizada, en coordenadas de mundo. */
  sunDirection: [number, number, number];
  fogColor: string;
  fogDensity: number;
}

const PRESETS: Record<SceneEnvironment["sky"], EnvironmentPreset> = {
  clear: {
    skyColor: "#8fbde8",
    groundColor: "#6b6f63",
    sunColor: "#fff4e0",
    sunIntensity: 2.4,
    ambientIntensity: 0.5,
    sunDirection: [0.6, 0.75, 0.3],
    fogColor: "#9dc3e6",
    fogDensity: 0.004,
  },
  cloudy: {
    skyColor: "#b9c3cc",
    groundColor: "#6d7069",
    sunColor: "#e8ecf2",
    sunIntensity: 1.2,
    ambientIntensity: 0.85,
    sunDirection: [0.4, 0.85, 0.2],
    fogColor: "#c2ccd6",
    fogDensity: 0.008,
  },
  sunset: {
    skyColor: "#e8a56b",
    groundColor: "#4a3f36",
    sunColor: "#ffb066",
    sunIntensity: 2.1,
    ambientIntensity: 0.45,
    sunDirection: [0.9, 0.22, -0.35],
    fogColor: "#d99a68",
    fogDensity: 0.01,
  },
  night: {
    skyColor: "#0e1626",
    groundColor: "#10141c",
    sunColor: "#9fb6e8",
    sunIntensity: 0.35,
    ambientIntensity: 0.22,
    sunDirection: [-0.4, 0.7, -0.5],
    fogColor: "#0b111c",
    fogDensity: 0.014,
  },
  studio: {
    skyColor: "#1b1f26",
    groundColor: "#15181d",
    sunColor: "#ffffff",
    sunIntensity: 1.8,
    ambientIntensity: 0.9,
    sunDirection: [0.5, 0.9, 0.4],
    fogColor: "#1b1f26",
    fogDensity: 0,
  },
};

export function environmentPreset(
  environment: SceneEnvironment,
): EnvironmentPreset {
  return PRESETS[environment.sky] ?? PRESETS.clear;
}

/**
 * Direccion del sol para una ubicacion, fecha y hora.
 *
 * Aproximacion astronomica suficiente para el estudio de sombras del editor:
 * declinacion solar por dia del ano y angulo horario local. No sustituye a un
 * calculo de eficiencia energetica certificado.
 */
export function sunDirectionFor(params: {
  latitude: number;
  longitude: number;
  date: Date;
  northAngleDeg?: number;
}): [number, number, number] {
  const { latitude, date } = params;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );

  const declination =
    23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)) * (Math.PI / 180);
  const hours = date.getHours() + date.getMinutes() / 60;
  const hourAngle = ((hours - 12) * 15 * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;

  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    -Math.sin(hourAngle),
    Math.tan(declination) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle),
  );

  const north = ((params.northAngleDeg ?? 0) * Math.PI) / 180;
  const corrected = azimuth + north;

  return [
    Math.cos(altitude) * Math.sin(corrected),
    Math.max(0.02, Math.sin(altitude)),
    Math.cos(altitude) * Math.cos(corrected),
  ];
}
