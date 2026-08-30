// World Environment — couche de CONTEXTE/PRÉSENTATION générique (pas un
// runtime, pas une simulation). Déterministe à partir de : ville + heure
// locale + météo optionnelle. Fonctionne toujours hors-ligne (fallback
// clair). Générique multi-villes (aucune constante Toulouse ici).

export type WorldPhase = "DAWN" | "DAY" | "SUNSET" | "NIGHT";

export type WeatherState =
  | "CLEAR" | "CLOUDY" | "RAIN" | "HEAVY_RAIN" | "STORM" | "FOG" | "SNOW";

export type WeatherObservation = {
  weather: WeatherState;
  temperatureC: number | null;
  precipitation: number;   // mm/h, 0 si inconnu
  cloudCover: number;      // 0-1
  windKph: number;
  observedAt: string;
  source: "provider" | "fallback";
};

export type WorldEnvironmentInput = {
  cityId: string;
  lat: number;
  now?: Date;
  weather?: WeatherObservation | null;
  /** densité de la ville (dense=1 → suburb/rural <1), pour ne rien hardcoder. */
  cityDensity?: number;
};

export type WorldEnvironmentState = {
  cityId: string;
  localTime: string;
  minutesOfDay: number;
  phase: WorldPhase;
  /** progression 0→1 à l'intérieur de la phase courante (transitions douces). */
  phaseProgress: number;
  weather: WeatherState;
  temperatureC: number | null;
  precipitation: number;
  cloudCover: number;
  windKph: number;
  /** 0 = plein jour lumineux, 1 = nuit profonde. */
  ambientDarkness: number;
  /** -1 = froid/bleuté, +1 = chaud/doré. */
  ambientWarmth: number;
  /** 0 = brouillard épais, 1 = parfaitement clair. */
  visibility: number;
  /** intensité générale des effets d'ambiance (respecte reduced-motion en amont). */
  ambientIntensity: number;
  cityDensity: number;
  weatherKnown: boolean;
};

// ── Soleil : approximation suffisante pour l'ambiance (pas de l'astronomie) ──
function solarTimes(lat: number, date: Date): { sunriseMin: number; sunsetMin: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const decl = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365) * (Math.PI / 180);
  const latRad = (lat * Math.PI) / 180;
  const x = -Math.tan(latRad) * Math.tan(decl);
  const clamped = Math.max(-1, Math.min(1, x));
  const halfDayHours = (Math.acos(clamped) * 180) / Math.PI / 15;
  const noon = 12 * 60; // midi solaire local approximé
  return {
    sunriseMin: Math.round(noon - halfDayHours * 60),
    sunsetMin: Math.round(noon + halfDayHours * 60),
  };
}

const TWILIGHT = 55; // minutes de transition autour du lever/coucher

export function computePhase(lat: number, now: Date): { phase: WorldPhase; progress: number; darkness: number; warmth: number } {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { sunriseMin, sunsetMin } = solarTimes(lat, now);

  const dawnStart = sunriseMin - TWILIGHT;
  const dawnEnd = sunriseMin + TWILIGHT;
  const setStart = sunsetMin - TWILIGHT;
  const setEnd = sunsetMin + TWILIGHT;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

  if (minutes < dawnStart || minutes >= setEnd) {
    // NUIT
    const intoNight = minutes >= setEnd
      ? (minutes - setEnd) / Math.max(1, 24 * 60 - setEnd + dawnStart)
      : (minutes + (24 * 60 - setEnd)) / Math.max(1, 24 * 60 - setEnd + dawnStart);
    return { phase: "NIGHT", progress: Math.max(0, Math.min(1, intoNight)), darkness: 0.92, warmth: -0.35 };
  }
  if (minutes < dawnEnd) {
    const t = (minutes - dawnStart) / (dawnEnd - dawnStart);
    return { phase: "DAWN", progress: t, darkness: lerp(0.85, 0.15, t), warmth: lerp(0.1, 0.55, 1 - Math.abs(t - 0.5) * 2) };
  }
  if (minutes < setStart) {
    return { phase: "DAY", progress: (minutes - dawnEnd) / Math.max(1, setStart - dawnEnd), darkness: 0.06, warmth: 0.0 };
  }
  // SUNSET
  const t = (minutes - setStart) / (setEnd - setStart);
  return { phase: "SUNSET", progress: t, darkness: lerp(0.12, 0.9, t), warmth: lerp(0.65, 0.15, t) };
}

// ── Météo ──────────────────────────────────────────────────────────────────
/** Normalise un code WMO (Open-Meteo) — mais l'API reste optionnelle. */
export function weatherFromWmo(code: number, precipitation = 0): WeatherState {
  if (code >= 95) return "STORM";
  if (code >= 71 && code <= 77) return "SNOW";
  if (code === 85 || code === 86) return "SNOW";
  if (code >= 80 && code <= 82) return precipitation >= 4 ? "HEAVY_RAIN" : "RAIN";
  if (code >= 61 && code <= 67) return precipitation >= 4 || code === 65 ? "HEAVY_RAIN" : "RAIN";
  if (code >= 51 && code <= 57) return "RAIN";
  if (code === 45 || code === 48) return "FOG";
  if (code === 2 || code === 3) return "CLOUDY";
  return "CLEAR";
}

export const FALLBACK_WEATHER: WeatherObservation = {
  weather: "CLEAR",
  temperatureC: null,
  precipitation: 0,
  cloudCover: 0.15,
  windKph: 6,
  observedAt: "1970-01-01T00:00:00.000Z",
  source: "fallback",
};

const WEATHER_VISIBILITY: Record<WeatherState, number> = {
  CLEAR: 1, CLOUDY: 0.85, RAIN: 0.7, HEAVY_RAIN: 0.55, STORM: 0.5, FOG: 0.35, SNOW: 0.6,
};
const WEATHER_DARK_BONUS: Record<WeatherState, number> = {
  CLEAR: 0, CLOUDY: 0.08, RAIN: 0.16, HEAVY_RAIN: 0.24, STORM: 0.3, FOG: 0.12, SNOW: 0.05,
};

export function computeWorldEnvironment(input: WorldEnvironmentInput): WorldEnvironmentState {
  const now = input.now ?? new Date();
  const obs = input.weather ?? FALLBACK_WEATHER;
  const { phase, progress, darkness, warmth } = computePhase(input.lat, now);

  const weatherDark = WEATHER_DARK_BONUS[obs.weather];
  const ambientDarkness = Math.max(0, Math.min(1, darkness + weatherDark * (1 - darkness) * 0.7));
  const visibility = Math.max(0.25, Math.min(1, WEATHER_VISIBILITY[obs.weather] - (phase === "NIGHT" ? 0.1 : 0)));
  const cloudDamp = 1 - obs.cloudCover * 0.4;

  return {
    cityId: input.cityId,
    localTime: now.toISOString(),
    minutesOfDay: now.getHours() * 60 + now.getMinutes(),
    phase,
    phaseProgress: progress,
    weather: obs.weather,
    temperatureC: obs.temperatureC,
    precipitation: obs.precipitation,
    cloudCover: obs.cloudCover,
    windKph: obs.windKph,
    ambientDarkness,
    ambientWarmth: warmth * cloudDamp,
    visibility,
    ambientIntensity: Math.max(0.15, Math.min(1, 0.35 + ambientDarkness * 0.4 + (1 - visibility) * 0.5)),
    cityDensity: input.cityDensity ?? 1,
    weatherKnown: obs.source === "provider",
  };
}

// ── Présentation : dérivations réutilisables par le web ET le natif ──────────

const WEATHER_EMOJI: Record<WeatherState, string> = {
  CLEAR: "☀️", CLOUDY: "☁️", RAIN: "🌧️", HEAVY_RAIN: "🌧️", STORM: "⛈️", FOG: "🌫️", SNOW: "❄️",
};
const PHASE_LABEL: Record<WorldPhase, string> = { DAWN: "Aube", DAY: "Jour", SUNSET: "Coucher", NIGHT: "Nuit" };

export function environmentHudLabel(env: WorldEnvironmentState, cityName: string): string {
  const temp = env.temperatureC != null ? `${Math.round(env.temperatureC)}°C · ` : "";
  return `${cityName} · ${temp}${WEATHER_EMOJI[env.weather]} · ${PHASE_LABEL[env.phase]}`;
}

/** Filtre CSS appliqué au canvas MapLibre : grading naturel, jamais néon. */
export function mapCanvasFilter(env: WorldEnvironmentState): string {
  const d = env.ambientDarkness;
  const brightness = (1.32 - d * 0.62).toFixed(3);          // jour lumineux → nuit sombre mais lisible
  const contrast = (0.96 + d * 0.06).toFixed(3);
  const saturate = (1.18 - d * 0.35 + (1 - env.visibility) * -0.15).toFixed(3);
  const sepia = Math.max(0, env.ambientWarmth * 0.22).toFixed(3);
  const hueRotate = env.ambientWarmth < 0 ? `${Math.round(env.ambientWarmth * 14)}deg` : "0deg";
  return `invert(1) hue-rotate(${215 + Math.round(env.ambientWarmth * -10)}deg) brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) hue-rotate(${hueRotate})`;
}

function ambientColor(env: WorldEnvironmentState): string {
  if (env.ambientWarmth > 0.25 && env.ambientDarkness < 0.6) return "#3a1e08"; // aube/coucher chaud
  if (env.phase === "NIGHT") return "#070a1a";
  return "#0a0e18";
}

/** Voile d'ambiance GLOBAL (app entière) — volontairement discret. */
export function ambientOverlay(env: WorldEnvironmentState): { color: string; opacity: number } {
  const base = env.ambientWarmth > 0.25 && env.ambientDarkness < 0.6
    ? env.ambientDarkness * 0.14 + 0.03
    : env.ambientDarkness * 0.14;
  return { color: ambientColor(env), opacity: Math.min(0.22, base) };
}

/** Voile d'ambiance spécifique à la CARTE (plus marqué, sous les contrôles). */
export function mapAmbientOverlay(env: WorldEnvironmentState): { color: string; opacity: number } {
  const g = ambientOverlay(env);
  return { color: g.color, opacity: Math.min(0.44, g.opacity * 1.9) };
}

/** Voile météo léger (haze / pluie). Retourne null si rien à afficher. */
export function weatherOverlay(env: WorldEnvironmentState): { kind: "haze" | "rain" | "storm" | null; opacity: number; color: string } {
  switch (env.weather) {
    case "FOG":
      return { kind: "haze", opacity: 0.34 * env.ambientIntensity + 0.1, color: "#8b95a5" };
    case "CLOUDY":
      return { kind: "haze", opacity: 0.1, color: "#5a6274" };
    case "RAIN":
      return { kind: "rain", opacity: 0.18, color: "#3d4657" };
    case "HEAVY_RAIN":
      return { kind: "rain", opacity: 0.26, color: "#2b323f" };
    case "STORM":
      return { kind: "storm", opacity: 0.3, color: "#20242e" };
    case "SNOW":
      return { kind: "haze", opacity: 0.14, color: "#c9d2dc" };
    default:
      return { kind: null, opacity: 0, color: "transparent" };
  }
}

/** Multiplicateur d'opacité pour les overlays de territoire crew selon l'ambiance. */
export function crewOverlayBoost(env: WorldEnvironmentState, districtMood?: string): number {
  let m = 1;
  if (env.phase === "NIGHT") m += 0.15;
  if (districtMood === "competitif") m += 0.35;
  if (districtMood === "nocturne" && env.phase === "NIGHT") m += 0.2;
  if (districtMood === "calme") m -= 0.15;
  return Math.max(0.6, Math.min(1.7, m));
}

export { WEATHER_EMOJI, PHASE_LABEL };
