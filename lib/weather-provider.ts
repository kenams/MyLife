import AsyncStorage from "@react-native-async-storage/async-storage";
import { weatherFromWmo, type WeatherObservation } from "./world-environment";

// Fournisseur météo OPTIONNEL. Open-Meteo : public, sans clé, sans quota.
// Isolé et remplaçable. Échec = null → World Environment retombe sur le
// fallback clair. Le jeu ne dépend jamais du réseau.

const CACHE_KEY = "mylife-weather-cache-v1";
const TTL_MS = 60 * 60_000; // 1 h
const TIMEOUT_MS = 3000;

type CacheShape = { lat: number; lng: number; obs: WeatherObservation; at: number };
let mem: CacheShape | null = null;

function near(a: number, b: number) {
  return Math.abs(a - b) < 0.15; // ~15 km : même météo
}

async function readCache(): Promise<CacheShape | null> {
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      mem = JSON.parse(raw) as CacheShape;
      return mem;
    }
  } catch { /* stockage indispo */ }
  return null;
}

async function writeCache(entry: CacheShape) {
  mem = entry;
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* ignore */ }
}

/**
 * Retourne une observation météo, du cache si frais, sinon tente le réseau
 * (timeout court). Ne throw jamais. `null` = inconnu → fallback en aval.
 */
let inFlight: Promise<WeatherObservation | null> | null = null;

export function fetchWeather(lat: number, lng: number): Promise<WeatherObservation | null> {
  if (inFlight) return inFlight;
  inFlight = fetchWeatherInner(lat, lng).finally(() => { inFlight = null; });
  return inFlight;
}

async function fetchWeatherInner(lat: number, lng: number): Promise<WeatherObservation | null> {
  const cached = await readCache();
  const fresh = cached && Date.now() - cached.at < TTL_MS && near(cached.lat, lat) && near(cached.lng, lng);
  if (fresh) return cached.obs;

  if (typeof fetch !== "function") return cached?.obs ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
      `&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return cached?.obs ?? null;
    const data = await res.json();
    const c = data?.current;
    if (!c) return cached?.obs ?? null;

    const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const precipitation = Math.max(0, num(c.precipitation));
    const temp = Number(c.temperature_2m);
    const obs: WeatherObservation = {
      weather: weatherFromWmo(num(c.weather_code), precipitation),
      temperatureC: Number.isFinite(temp) ? temp : null,
      precipitation,
      cloudCover: Math.max(0, Math.min(1, num(c.cloud_cover) / 100)),
      windKph: Math.max(0, num(c.wind_speed_10m)),
      observedAt: new Date().toISOString(),
      source: "provider",
    };
    await writeCache({ lat, lng, obs, at: Date.now() });
    return obs;
  } catch {
    clearTimeout(timer);
    return cached?.obs ?? null;
  }
}
