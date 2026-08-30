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

export type CityActivityEstimate = {
  referencePopulation: number;
  awakePopulation: number;
  mobilePopulation: number;
  socialPopulation: number;
  materializedAgents: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Estimate the real city rhythm without turning residents into individual
 * objects. These numbers are background population signals, not map markers.
 */
export function estimateCityActivity(
  at: Date = new Date(),
  city: CitySimulationConfig = TOULOUSE_CITY,
  zoom = 12,
): CityActivityEstimate {
  const hour = at.getHours() + at.getMinutes() / 60;
  const weekend = at.getDay() === 0 || at.getDay() === 6;

  let awakeShare = 0.92;
  let mobileShare = 0.16;
  let socialShare = weekend ? 0.14 : 0.09;

  if (hour < 5) {
    awakeShare = 0.12;
    mobileShare = 0.025;
    socialShare = 0.018;
  } else if (hour < 7) {
    awakeShare = 0.45;
    mobileShare = 0.11;
    socialShare = 0.025;
  } else if (hour < 10) {
    awakeShare = 0.93;
    mobileShare = weekend ? 0.12 : 0.29;
    socialShare = 0.035;
  } else if (hour < 12) {
    awakeShare = 0.97;
    mobileShare = 0.13;
    socialShare = weekend ? 0.11 : 0.055;
  } else if (hour < 14) {
    awakeShare = 0.98;
    mobileShare = 0.23;
    socialShare = 0.14;
  } else if (hour < 17) {
    awakeShare = 0.98;
    mobileShare = 0.14;
    socialShare = weekend ? 0.16 : 0.075;
  } else if (hour < 20) {
    awakeShare = 0.97;
    mobileShare = 0.31;
    socialShare = 0.19;
  } else if (hour < 23) {
    awakeShare = 0.84;
    mobileShare = 0.18;
    socialShare = weekend ? 0.25 : 0.18;
  } else {
    awakeShare = 0.48;
    mobileShare = 0.08;
    socialShare = weekend ? 0.14 : 0.075;
  }

  const awakePopulation = Math.round(city.referencePopulation * awakeShare);
  const mobilePopulation = Math.round(city.referencePopulation * mobileShare);
  const socialPopulation = Math.round(city.referencePopulation * socialShare);

  // Materialisation is deliberately bounded. Zooming in increases individual
  // detail; zooming out relies on clusters/aggregate city signals.
  const zoomFactor = clamp((zoom - 9) / 8, 0, 1);
  const rhythmFactor = clamp(mobileShare / 0.31, 0.25, 1);
  const materializedAgents = Math.round(120 + zoomFactor * 90 + rhythmFactor * 40);

  return {
    referencePopulation: city.referencePopulation,
    awakePopulation,
    mobilePopulation,
    socialPopulation,
    materializedAgents: clamp(materializedAgents, 90, 250),
  };
}

function actionLabel(npc: NpcState): string {
  const action = String(npc.currentActivity ?? npc.action ?? "idle");
  const labels: Record<string, string> = {
    working: "💼 Au travail",
    work: "💼 Au travail",
    study: "📚 Étudie",
    eating: "🍽️ Mange en ville",
    restaurant: "🍽️ Au restaurant",
    cafe: "☕ Au café",
    chatting: "☕ Socialise",
    outing: "🎉 En sortie",
    date: "💫 En rencontre",
    crew: "🤝 Avec son crew",
    mission: "🎯 Sur une mission",
    event: "🎉 Événement en ville",
    exercising: "🏋️ Fait du sport",
    gym: "🏋️ Salle de sport",
    park: "🌳 Au parc",
    shopping: "🛍️ Shopping",
    walking: "🚶 Se déplace à pied",
    car: "🚗 En voiture",
    metro: "🚇 Dans le métro",
    sleeping: "💤 Dort",
    sleep: "💤 Dort",
    idle: "🏠 Vie quotidienne",
    waving: "👋 Socialise",
  };
  return labels[action] ?? action;
}

function actionStatus(npc: NpcState): MapStatus {
  const action = String(npc.currentActivity ?? npc.action ?? "idle");
  if (action === "chatting" || action === "outing" || action === "event" || action === "cafe") return "vibe";
  if (action === "crew" || npc.crewId) return "taken";
  if (action === "date") return "charo";
  if (action === "mission") return "free";
  if ((npc.sociability ?? 0) >= 72 && npc.presenceOnline) return "charo";
  // Crew membership is a social affiliation, never a romantic relationship status.
  // Relationship-aware statuses can be projected here once NpcState exposes them explicitly.
  return "free";
}

function avatarFor(npc: NpcState): string {
  const action = String(npc.currentActivity ?? npc.action ?? "idle");
  if (npc.crewTag) return npc.crewTag.slice(0, 1).toUpperCase();
  if (action === "working" || action === "work") return "💼";
  if (action === "eating" || action === "restaurant" || action === "cafe") return "☕";
  if (action === "exercising" || action === "gym") return "🏋️";
  if (action === "chatting" || action === "outing" || action === "date") return "💬";
  if (action === "mission") return "🎯";
  return "🧑";
}

/** Stable, privacy-safe synthetic coordinates around a district centre.
 * posX/posY are used as deterministic movement inputs, so Living City ticks
 * become visible without GPS, DB writes, or one timer per NPC.
 */
export function projectNpcPosition(
  npc: NpcState,
  city: CitySimulationConfig = TOULOUSE_CITY,
): { lat: number; lng: number } {
  const direct = npc as unknown as { lat?: unknown; lng?: unknown };
  const directLat = typeof direct.lat === "number" ? direct.lat : null;
  const directLng = typeof direct.lng === "number" ? direct.lng : null;
  if (directLat != null && directLng != null) {
    return {
      lat: clamp(directLat, -90, 90),
      lng: clamp(directLng, -180, 180),
    };
  }

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
    avatar_emoji: avatarFor(npc),
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

export function selectMaterializedNpcs(
  npcs: NpcState[],
  at: Date = new Date(),
  city: CitySimulationConfig = TOULOUSE_CITY,
  zoom = 12,
): NpcState[] {
  const budget = estimateCityActivity(at, city, zoom).materializedAgents;
  // Ensemble STABLE tick après tick : on trie par un hash déterministe de l'id
  // (sans la date, sans presenceOnline) pour éviter la valse ghost/add qui
  // faisait "disparaître" la ville. presenceOnline n'influence plus que le
  // statut affiché, pas la présence sur la carte.
  return [...npcs]
    .sort((a, b) => hash(a.id) - hash(b.id))
    .slice(0, budget);
}

export function livingNpcsToMapPlayers(
  npcs: NpcState[],
  city: CitySimulationConfig = TOULOUSE_CITY,
  at: Date = new Date(),
  zoom = 12,
): MapPlayer[] {
  return selectMaterializedNpcs(npcs, at, city, zoom).map((npc) => livingNpcToMapPlayer(npc, city));
}

export function cityActivitySummary(realPlayers: MapPlayer[], npcs: NpcState[], at: Date = new Date()) {
  const real = realPlayers.filter((p) => !p.is_npc && p.status !== "ghost").length;
  const simulation = estimateCityActivity(at);
  const simulated = npcs.filter((npc) => npc.presenceOnline).length;
  return {
    real,
    simulated,
    materialized: Math.min(simulated, simulation.materializedAgents),
    cityAwakeEstimate: simulation.awakePopulation,
    cityMobileEstimate: simulation.mobilePopulation,
    total: real + simulated,
  };
}
