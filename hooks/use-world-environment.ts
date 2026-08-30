import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { ACTIVE_CITY } from "@/lib/city-config";
import {
  computeWorldEnvironment,
  type WeatherObservation,
  type WorldEnvironmentState,
} from "@/lib/world-environment";
import { fetchWeather } from "@/lib/weather-provider";

const RECOMPUTE_MS = 5 * 60_000;   // ambiance : recalcul time-bucketé
const WEATHER_MS = 60 * 60_000;    // météo : 1 fetch / h max

function prefersReducedMotion(): boolean {
  if (Platform.OS === "web") {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }
  return false;
}

/**
 * Contexte World Environment (ville + heure locale + météo optionnelle).
 * UN seul timer de recalcul, UN fetch météo/h. Fonctionne toujours : si la
 * météo échoue, on reste en clair. Ne relance jamais CityRuntime.
 */
export function useWorldEnvironment(): WorldEnvironmentState {
  const lat = ACTIVE_CITY.center.lat;
  const lng = ACTIVE_CITY.center.lng;

  const [tick, setTick] = useState(0);
  const [weather, setWeather] = useState<WeatherObservation | null>(null);
  const reduced = useRef(prefersReducedMotion());

  useEffect(() => {
    if (Platform.OS !== "web") {
      AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduced.current = v; }).catch(() => {});
    }
    const clock = setInterval(() => setTick((t) => t + 1), RECOMPUTE_MS);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => {
      fetchWeather(lat, lng).then((obs) => { if (alive && obs) setWeather(obs); }).catch(() => {});
    };
    run();
    const id = setInterval(run, WEATHER_MS);
    return () => { alive = false; clearInterval(id); };
  }, [lat, lng]);

  return useMemo(() => {
    const env = computeWorldEnvironment({ cityId: ACTIVE_CITY.id, lat, weather, now: new Date() });
    if (reduced.current) {
      return { ...env, ambientIntensity: Math.min(env.ambientIntensity, 0.25), phaseProgress: 0 };
    }
    return env;
    // tick force le recalcul time-bucketé
  }, [lat, weather, tick]);
}
