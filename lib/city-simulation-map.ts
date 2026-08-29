import type { MapPlayer, MapStatus } from "@/lib/life-map";
import type { NpcState } from "@/lib/types";

/**
 * City simulation projection layer.
 *
 * Product invariant: MyLife simulates a city, not a fixed list of map bots.
 * The reference population is demographic context; only a bounded, relevant
 * sample is materialised as detailed NPCs by Living City.
 *
 * Toulouse is the first city config. Future cities plug into the same engine.
 */
export type CitySimulationConfig = {
  id: string;
  name: string;
  countryCode: string;
  referencePopulation: number;
  center: { lat: number; lng: number };
  districts: Record<string, { lat: number; lng: number; spreadLat: number; spreadLng: number }>;
};

export const TOULOUSE_CITY: CitySimulationConfig = {
  id: "toulouse-fr",
  name: "Toulouse",
  countryCode: "FR",
  // Reference scale only. Never instantiate one NPC per resident.
  referencePopulation: 515_000,
  center: { lat: 43.6047, lng: 1.4442 },
  districts: {
    Capitole: { lat: 43.6047, lng: 1.4442, spreadLat: 0.0045, spreadLng: 0.0055 },
    "Jean-Jaures": { lat: 43.6056, lng: 1.4495, spreadLat: 0.0045, spreadLng: 0.0055 },
    Compans: { lat: 43.6119, lng: 1.4348, spreadLat: 0.0055, spreadLng: 0.0065 },
    "Saint-Cyprien": { lat: 43.5998, lng: 1.4325, spreadLat: 0.0055, spreadLng: 0.0065 },
    Carmes: { lat: 43.5983, lng: 1.4457, spreadLat: 0.004, spreadLng: 0.005 },
    Rangueil: { lat: 43.5749, lng: 1.462, spreadLat: 0.008, spreadLng: 0.009 },
    Minimes: { lat: 43.62, lng: 1.436, spreadLat: 0.007, spreadLng: 0.008 },
    "Saint-Aubin": { lat: 43.6069, lng: 1.4554, spreadLat: 0.0045, spreadLng: 0.0055 },
    Esquirol: { lat: 43.6009, lng: 1.4448, spreadLat: 0.0035, spreadLng: 0.0045 },
    Bonnefoy: { lat: 43.6167, lng: 1.459, spreadLat: 0.006, spreadLng: 0.007 },
  },
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unit(seed: string): number {
  return (hash(seed) % 10_000) / 10_000;
}

function actionLabel(npc: NpcState): string {
  const action = String(npc.currentActivity ?? npc.action ?? "idle");
  const labels: Record<string, string> = {
    working: "💼 Au travail",
    eating: "🍽️ Mange",
    chatting: "☕ Socialise",
    exercising: "🏋️ Fait du sport",
    walking: "🚶 Se déplace à pied",
    sleeping: "💤 Dort",
    idle: "🏠 Vie quotidienne",
    waving: "👋 Socialise",
  };
  return labels[action] ?? action;
}

function actionStatus(npc: NpcState): MapStatus {
  const action = String(npc.currentActivity ?? npc.action ?? "idle");
  if (action === "chatting") return "vibe";
  if ((npc.sociability ?? 0) >= 72 && npc.presenceOnline) return "charo";
  if (npc.crewId) return "taken";
  return "free";
}

/** Stable, privacy-safe synthetic coordinates around a district centre.
 * posX/posY are used as deterministic movement inputs, so Living City ticks
 * become visible without GPS, DB writes, or one timer per NPC.
 */
export function projectNpcPosition(
  npc: NpcState,
  city: CitySimulationConfig = TOULOUSE_CITY,
): { lat: number; lng: number } {
  const districtName = npc.homeDistrictSlug ?? "Capitole";
  const district = city.districts[districtName] ?? {
    lat: city.center.lat,
    lng: city.center.lng,
    spreadLat: 0.006,
    spreadLng: 0.007,
  };
  const px = typeof npc.posX === "number" ? npc.posX / 100 : unit(`${npc.id}:x`);
  const py = typeof npc.posY === "number" ? npc.posY / 100 : unit(`${npc.id}:y`);
  const jitterX = (unit(`${npc.id}:jx`) - 0.5) * 0.18;
  const jitterY = (unit(`${npc.id}:jy`) - 0.5) * 0.18;
  return {
    lat: district.lat + ((py - 0.5) + jitterY) * district.spreadLat,
    lng: district.lng + ((px - 0.5) + jitterX) * district.spreadLng,
  };
}

/** Adapter consumed by the existing MapLibre player GeoJSON pipeline. */
export function livingNpcToMapPlayer(
  npc: NpcState,
  city: CitySimulationConfig = TOULOUSE_CITY,
): MapPlayer {
  const pos = projectNpcPosition(npc, city);
  return {
    id: npc.id,
    user_id: npc.id,
    display_name: npc.name,
    avatar_emoji: "🧑",
    status: actionStatus(npc),
    lat: pos.lat,
    lng: pos.lng,
    location_name: npc.homeDistrictSlug ?? city.name,
    location_verified: false,
    last_action: actionLabel(npc),
    is_star: false,
    is_npc: true,
    level: npc.level ?? 1,
    crew_color: null,
    crew_tag: npc.crewTag ?? null,
    updated_at: npc.lastTickAt ?? new Date().toISOString(),
  };
}

export function livingNpcsToMapPlayers(
  npcs: NpcState[],
  city: CitySimulationConfig = TOULOUSE_CITY,
): MapPlayer[] {
  return npcs.filter((npc) => npc.presenceOnline).map((npc) => livingNpcToMapPlayer(npc, city));
}

export function cityActivitySummary(realPlayers: MapPlayer[], npcs: NpcState[]) {
  const real = realPlayers.filter((p) => !p.is_npc && p.status !== "ghost").length;
  const simulated = npcs.filter((npc) => npc.presenceOnline).length;
  return { real, simulated, total: real + simulated };
}
