import {
  TOULOUSE_CITY,
  livingNpcToMapPlayer,
  livingNpcsToMapPlayers,
  projectNpcPosition,
  selectMaterializedNpcs,
  estimateCityActivity,
  type CitySimulationConfig,
} from "@/lib/city-simulation-map";
import type { MapPlayer, MapStatus } from "@/lib/life-map";
import type { TravelMode } from "@/lib/npc-travel";
import type { NpcState } from "@/lib/types";

/**
 * COUCHE DE PROJECTION PARTAGÉE — web (MapLibre) ET natif (react-native-maps).
 *
 * Entrée : NpcState[] + timestamp (+ zoom / device budget).
 * Sortie : ProjectedResident[] — DOM-free, MapLibre-free, RN-free.
 *
 * Les deux renderers consomment CETTE fonction. Ils peuvent lisser différemment
 * (rAF web, Animated natif) mais AUCUNE logique métier ne diffère : même
 * population, même sélection, mêmes positions, mêmes activités.
 */

export type ProjectedResident = {
  id: string;
  lat: number;
  lng: number;
  status: MapStatus;
  activity: string | null;
  avatar: string;
  displayName: string;
  crewTag: string | null;
  level: number;
  isNpc: true;
  travelMode: TravelMode | null;
  destination: string | null;
};

export type DeviceTier = "low" | "standard" | "desktop";

/** Budget de matérialisation selon la puissance de l'appareil. */
export function budgetForDevice(tier: DeviceTier, at: Date = new Date()): number {
  const base = estimateCityActivity(at, TOULOUSE_CITY, tier === "desktop" ? 14 : 13).materializedAgents;
  if (tier === "low") return Math.min(base, 140);
  if (tier === "standard") return Math.min(base, 220);
  return Math.min(base, 240);
}

function toResident(player: MapPlayer): ProjectedResident {
  return {
    id: player.id,
    lat: player.lat,
    lng: player.lng,
    status: player.status,
    activity: player.last_action,
    avatar: player.avatar_emoji,
    displayName: player.display_name,
    crewTag: player.crew_tag ?? null,
    level: player.level ?? 1,
    isNpc: true,
    travelMode: player.travel_mode ?? null,
    destination: player.destination ?? null,
  };
}

/**
 * Projection principale. `zoom` module la matérialisation (clusters au dézoom).
 * `at` doit être l'horloge courante à chaque appel — la position en trajet en
 * dépend directement (mouvement visible sans nouveau tick de simulation).
 */
export function projectCityResidents(
  npcs: NpcState[],
  at: Date = new Date(),
  opts: { zoom?: number; city?: CitySimulationConfig; cap?: number } = {},
): ProjectedResident[] {
  const zoom = opts.zoom ?? 13;
  const city = opts.city ?? TOULOUSE_CITY;
  let players = livingNpcsToMapPlayers(npcs, city, at, zoom);
  if (opts.cap != null && players.length > opts.cap) players = players.slice(0, opts.cap);
  return players.map(toResident);
}

/** Une seule projection (fiche PNJ, focus). */
export function projectResident(npc: NpcState, at: Date = new Date()): ProjectedResident {
  return toResident(livingNpcToMapPlayer(npc, TOULOUSE_CITY, at));
}

// Ré-exports pour que les 2 renderers importent d'un seul endroit.
export {
  projectNpcPosition,
  selectMaterializedNpcs,
  estimateCityActivity,
  livingNpcsToMapPlayers,
  TOULOUSE_CITY,
};
export type { MapPlayer };
