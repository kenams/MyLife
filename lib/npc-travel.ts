import type { NpcState } from "@/lib/types";

/**
 * Déplacement coarse des habitants simulés.
 *
 * Objectif : rendre le mouvement VISIBLE sur la Map sans un timer par PNJ ni
 * un moteur de routing. Un trajet = origine → destination (ancres de quartier)
 * + un mode + une fenêtre [start, end]. La simulation avance l'état toutes les
 * 15–30 s ; la position lat/lng est interpolée linéairement entre les deux
 * ancres selon la progression temporelle. La couche de présentation ajoute
 * ensuite un lissage visuel (voir lib/map-interpolation.ts).
 *
 * Tout est pur et déterministe (seed injecté) pour rester testable.
 */

export type TravelMode = "WALK" | "BIKE" | "CAR" | "BUS" | "METRO" | "TRAM";

export type DistrictAnchor = { slug: string; lat: number; lng: number };

// Ancres géographiques réelles des quartiers de Toulouse utilisés par la
// simulation. Les slugs correspondent à ceux de lib/living-city.ts (DISTRICTS)
// et de TOULOUSE_CITY dans lib/city-simulation-map.ts.
export const DISTRICT_ANCHORS: Record<string, DistrictAnchor> = {
  Capitole:        { slug: "Capitole",        lat: 43.6045, lng: 1.4440 },
  "Jean-Jaures":   { slug: "Jean-Jaures",     lat: 43.6068, lng: 1.4497 },
  Compans:         { slug: "Compans",         lat: 43.6119, lng: 1.4348 },
  "Saint-Cyprien": { slug: "Saint-Cyprien",   lat: 43.5998, lng: 1.4325 },
  Carmes:          { slug: "Carmes",          lat: 43.5983, lng: 1.4457 },
  Rangueil:        { slug: "Rangueil",        lat: 43.5749, lng: 1.4620 },
  Minimes:         { slug: "Minimes",         lat: 43.6200, lng: 1.4360 },
  "Saint-Aubin":   { slug: "Saint-Aubin",     lat: 43.6039, lng: 1.4554 },
  Esquirol:        { slug: "Esquirol",        lat: 43.6009, lng: 1.4448 },
  Bonnefoy:        { slug: "Bonnefoy",        lat: 43.6167, lng: 1.4560 },
};

export const DEFAULT_DISTRICT = "Capitole";

const MODE_META: Record<TravelMode, { label: string; emoji: string; minPerKm: number }> = {
  WALK:  { label: "à pied",      emoji: "🚶", minPerKm: 12 },
  BIKE:  { label: "à vélo",      emoji: "🚲", minPerKm: 4.5 },
  CAR:   { label: "en voiture",  emoji: "🚗", minPerKm: 3 },
  BUS:   { label: "en bus",      emoji: "🚌", minPerKm: 5 },
  METRO: { label: "en métro",    emoji: "🚇", minPerKm: 2.4 },
  TRAM:  { label: "en tram",     emoji: "🚋", minPerKm: 3.6 },
};

export function travelModeEmoji(mode: TravelMode): string {
  return MODE_META[mode].emoji;
}

export function anchorFor(slug: string | null | undefined): DistrictAnchor {
  return DISTRICT_ANCHORS[slug ?? DEFAULT_DISTRICT] ?? DISTRICT_ANCHORS[DEFAULT_DISTRICT];
}

/** Distance approx. en km entre deux quartiers (équirectangulaire, suffisant). */
export function districtDistanceKm(a: string, b: string): number {
  const pa = anchorFor(a);
  const pb = anchorFor(b);
  const midLat = ((pa.lat + pb.lat) / 2) * (Math.PI / 180);
  const dx = (pb.lng - pa.lng) * Math.cos(midLat) * 111.32;
  const dy = (pb.lat - pa.lat) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

function pickMode(distanceKm: number, archetypes: string[], random: () => number): TravelMode {
  if (distanceKm < 0.6) return random() > 0.25 ? "WALK" : "BIKE";
  if (distanceKm < 1.4) {
    if (archetypes.includes("sportif")) return random() > 0.4 ? "BIKE" : "WALK";
    return random() > 0.55 ? "WALK" : random() > 0.5 ? "BUS" : "METRO";
  }
  if (distanceKm < 3) {
    const roll = random();
    if (roll > 0.6) return "METRO";
    if (roll > 0.4) return "BUS";
    if (roll > 0.2) return "TRAM";
    return "CAR";
  }
  return random() > 0.45 ? "CAR" : random() > 0.5 ? "METRO" : "TRAM";
}

/** Où un PNJ devrait se trouver pour une activité donnée. */
export function anchorDistrictForActivity(
  npc: NpcState,
  action: string,
  random: () => number,
): string {
  const home = npc.homeDistrictSlug ?? DEFAULT_DISTRICT;
  const crewDistrict = npc.crewTag ? crewDistrictFor(npc.crewTag) : null;
  const districts = Object.keys(DISTRICT_ANCHORS);
  switch (action) {
    case "sleeping":
      return home;
    case "working":
      // lieu de travail stable par PNJ, dérivé de son id
      return districts[Math.abs(hashString(`${npc.id}:work`)) % districts.length];
    case "exercising":
      return random() > 0.5 ? home : districts[Math.abs(hashString(`${npc.id}:gym`)) % districts.length];
    case "chatting":
      if (crewDistrict && random() > 0.5) return crewDistrict;
      return districts[Math.abs(hashString(`${npc.id}:social:${Math.floor(random() * 6)}`)) % districts.length];
    case "eating":
      return random() > 0.4 ? home : pickNeighbour(home, random);
    case "walking":
      return pickNeighbour(home, random);
    default:
      return home;
  }
}

function pickNeighbour(slug: string, random: () => number): string {
  const districts = Object.keys(DISTRICT_ANCHORS).filter((d) => d !== slug);
  const scored = districts
    .map((d) => ({ d, dist: districtDistanceKm(slug, d) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4);
  return scored[Math.floor(random() * scored.length)]?.d ?? slug;
}

function crewDistrictFor(tag: string): string | null {
  const map: Record<string, string> = {
    WLV: "Compans", KNG: "Capitole", OWL: "Jean-Jaures", GAR: "Saint-Cyprien", MRL: "Rangueil",
  };
  return map[tag] ?? null;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export type PlannedTrip = {
  originDistrictSlug: string;
  destDistrictSlug: string;
  travelMode: TravelMode;
  travelStartedAt: string;
  travelEndsAt: string;
};

/**
 * Décide si le PNJ démarre un trajet vers le quartier cohérent avec `action`.
 * Retourne null si le PNJ est déjà au bon endroit (pas de trajet inutile).
 */
export function planTrip(
  npc: NpcState,
  action: string,
  now: Date,
  random: () => number,
): PlannedTrip | null {
  const from = npc.currentDistrictSlug ?? npc.homeDistrictSlug ?? DEFAULT_DISTRICT;
  const to = anchorDistrictForActivity(npc, action, random);
  if (to === from) return null;

  const distanceKm = districtDistanceKm(from, to);
  const mode = pickMode(distanceKm, (npc.personality ?? "").split("/"), random);
  const waitMin = MODE_META[mode].minPerKm * 0.4; // petite attente (arrêt, feu…)
  const travelMin = Math.max(2, Math.round(distanceKm * MODE_META[mode].minPerKm + waitMin));
  return {
    originDistrictSlug: from,
    destDistrictSlug: to,
    travelMode: mode,
    travelStartedAt: now.toISOString(),
    travelEndsAt: new Date(now.getTime() + travelMin * 60_000).toISOString(),
  };
}

export function isTraveling(npc: NpcState, now: Date = new Date()): boolean {
  if (!npc.travelEndsAt || !npc.destDistrictSlug) return false;
  return new Date(npc.travelEndsAt).getTime() > now.getTime();
}

/** Progression 0..1 du trajet en cours. */
export function tripProgress(npc: NpcState, now: Date = new Date()): number {
  if (!npc.travelStartedAt || !npc.travelEndsAt) return 1;
  const start = new Date(npc.travelStartedAt).getTime();
  const end = new Date(npc.travelEndsAt).getTime();
  if (end <= start) return 1;
  const p = (now.getTime() - start) / (end - start);
  return Math.max(0, Math.min(1, p));
}

/** Position géographique interpolée (origine → destination). */
export function travelPosition(
  npc: NpcState,
  now: Date = new Date(),
): { lat: number; lng: number } | null {
  if (!npc.originDistrictSlug || !npc.destDistrictSlug) return null;
  const a = anchorFor(npc.originDistrictSlug);
  const b = anchorFor(npc.destDistrictSlug);
  const t = tripProgress(npc, now);
  // léger arc pour que la trajectoire ne soit pas une droite parfaite
  const bow = Math.sin(t * Math.PI) * 0.0016;
  const seed = hashString(npc.id) % 2 === 0 ? 1 : -1;
  return {
    lat: a.lat + (b.lat - a.lat) * t + bow * seed,
    lng: a.lng + (b.lng - a.lng) * t - bow * seed,
  };
}

export function travelActivityLabel(mode: TravelMode, destSlug: string): string {
  const dest = anchorFor(destSlug).slug.replace(/-/g, " ");
  return `${MODE_META[mode].emoji} En trajet vers ${dest}`;
}

export const TRANSIT_MODES: TravelMode[] = ["BUS", "METRO", "TRAM"];
