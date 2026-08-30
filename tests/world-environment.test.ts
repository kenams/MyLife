import { describe, expect, it } from "vitest";

import {
  computePhase,
  computeWorldEnvironment,
  weatherFromWmo,
  mapCanvasFilter,
  ambientOverlay,
  mapAmbientOverlay,
  weatherOverlay,
  environmentHudLabel,
  crewOverlayBoost,
  FALLBACK_WEATHER,
  type WeatherObservation,
} from "../lib/world-environment";

const TLS_LAT = 43.6; // Toulouse — mais l'API est générique
const summerNoon = new Date("2026-07-01T12:00:00");
const summerMidnight = new Date("2026-07-01T00:30:00");
const winterMorning = new Date("2026-01-15T08:00:00");

describe("computePhase", () => {
  it("is DAY around local noon and NIGHT after midnight (deterministic)", () => {
    expect(computePhase(TLS_LAT, summerNoon).phase).toBe("DAY");
    expect(computePhase(TLS_LAT, summerMidnight).phase).toBe("NIGHT");
    expect(computePhase(TLS_LAT, summerNoon)).toEqual(computePhase(TLS_LAT, summerNoon));
  });

  it("night is darker than day", () => {
    expect(computePhase(TLS_LAT, summerMidnight).darkness).toBeGreaterThan(computePhase(TLS_LAT, summerNoon).darkness);
  });

  it("winter mornings are dawn/near-dark, summer noon is bright", () => {
    const w = computePhase(TLS_LAT, winterMorning);
    expect(["DAWN", "NIGHT"]).toContain(w.phase);
    expect(computePhase(TLS_LAT, summerNoon).darkness).toBeLessThan(0.2);
  });

  it("phaseProgress stays within [0,1]", () => {
    for (let h = 0; h < 24; h++) {
      const p = computePhase(TLS_LAT, new Date(2026, 5, 1, h, 0));
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe("weatherFromWmo", () => {
  it("normalises WMO codes to weather states", () => {
    expect(weatherFromWmo(0)).toBe("CLEAR");
    expect(weatherFromWmo(3)).toBe("CLOUDY");
    expect(weatherFromWmo(45)).toBe("FOG");
    expect(weatherFromWmo(61)).toBe("RAIN");
    expect(weatherFromWmo(65, 6)).toBe("HEAVY_RAIN");
    expect(weatherFromWmo(95)).toBe("STORM");
    expect(weatherFromWmo(73)).toBe("SNOW");
  });
});

describe("computeWorldEnvironment", () => {
  it("works fully offline with the clear fallback (no weather)", () => {
    const env = computeWorldEnvironment({ cityId: "toulouse", lat: TLS_LAT, now: summerNoon });
    expect(env.weather).toBe("CLEAR");
    expect(env.weatherKnown).toBe(false);
    expect(env.phase).toBe("DAY");
  });

  it("rain deepens ambient darkness and lowers visibility", () => {
    const rain: WeatherObservation = { ...FALLBACK_WEATHER, weather: "HEAVY_RAIN", source: "provider", cloudCover: 0.9 };
    const clear = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerNoon });
    const wet = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerNoon, weather: rain });
    expect(wet.ambientDarkness).toBeGreaterThan(clear.ambientDarkness);
    expect(wet.visibility).toBeLessThan(clear.visibility);
    expect(wet.weatherKnown).toBe(true);
  });

  it("is city-agnostic — a different latitude changes the phase timing", () => {
    const hk = computeWorldEnvironment({ cityId: "hongkong", lat: 22.3, now: new Date("2026-01-15T18:00:00") });
    const paris = computeWorldEnvironment({ cityId: "paris", lat: 48.85, now: new Date("2026-01-15T18:00:00") });
    expect(hk.phase === paris.phase && hk.ambientDarkness === paris.ambientDarkness).toBe(false);
  });
});

describe("presentation helpers", () => {
  it("mapCanvasFilter never contains an extreme saturate and is darker at night", () => {
    const day = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerNoon });
    const night = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerMidnight });
    const sat = (f: string) => Number(f.match(/saturate\(([\d.]+)\)/)?.[1] ?? "0");
    const bri = (f: string) => Number(f.match(/brightness\(([\d.]+)\)/)?.[1] ?? "0");
    expect(sat(mapCanvasFilter(day))).toBeLessThan(1.4);
    expect(bri(mapCanvasFilter(night))).toBeLessThan(bri(mapCanvasFilter(day)));
    expect(bri(mapCanvasFilter(night))).toBeGreaterThan(0.5); // toujours lisible
  });

  it("global ambient overlay stays discreet (<= 0.22), map overlay stronger", () => {
    const night = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerMidnight });
    expect(ambientOverlay(night).opacity).toBeLessThanOrEqual(0.22);
    expect(mapAmbientOverlay(night).opacity).toBeGreaterThan(ambientOverlay(night).opacity);
    expect(mapAmbientOverlay(night).opacity).toBeLessThanOrEqual(0.44);
  });

  it("clear weather has no overlay; rain/fog produce a bounded overlay", () => {
    const clear = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerNoon });
    expect(weatherOverlay(clear).kind).toBeNull();
    const fog = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerNoon, weather: { ...FALLBACK_WEATHER, weather: "FOG", source: "provider" } });
    const w = weatherOverlay(fog);
    expect(w.kind).toBe("haze");
    expect(w.opacity).toBeLessThan(0.5);
  });

  it("HUD label reads like 'City · 20°C · 🌧️ · Nuit'", () => {
    const env = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerMidnight, weather: { ...FALLBACK_WEATHER, weather: "RAIN", temperatureC: 12.4, source: "provider" } });
    const label = environmentHudLabel(env, "Toulouse");
    expect(label).toContain("Toulouse");
    expect(label).toContain("12°C");
    expect(label).toContain("Nuit");
  });

  it("crewOverlayBoost is bounded and lifts competitive districts, calms 'calme' ones", () => {
    const night = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerMidnight });
    const day = computeWorldEnvironment({ cityId: "c", lat: TLS_LAT, now: summerNoon });
    expect(crewOverlayBoost(night, "competitif")).toBeGreaterThan(crewOverlayBoost(day, "calme"));
    expect(crewOverlayBoost(night, "competitif")).toBeLessThanOrEqual(1.7);
    expect(crewOverlayBoost(day, "calme")).toBeGreaterThanOrEqual(0.6);
  });
});
