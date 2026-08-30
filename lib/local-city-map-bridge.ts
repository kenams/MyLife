import type { MapPlayer } from "@/lib/life-map";

let currentPlayers: MapPlayer[] = [];
const listeners = new Set<(player: MapPlayer) => void>();

function signature(player: MapPlayer): string {
  return [
    player.status,
    player.lat.toFixed(5),
    player.lng.toFixed(5),
    player.last_action ?? "",
    player.location_name ?? "",
    player.crew_tag ?? "",
  ].join("|");
}

/**
 * Bridge between the local Living City runtime and the existing Life Map
 * realtime contract. No DB write is required for simulated residents.
 */
export function publishLocalCityPlayers(nextPlayers: MapPlayer[]) {
  const previousById = new Map(currentPlayers.map((player) => [player.id, player]));
  const nextById = new Map(nextPlayers.map((player) => [player.id, player]));

  for (const previous of currentPlayers) {
    if (nextById.has(previous.id)) continue;
    const ghost: MapPlayer = { ...previous, status: "ghost", updated_at: new Date().toISOString() };
    listeners.forEach((listener) => listener(ghost));
  }

  for (const player of nextPlayers) {
    const previous = previousById.get(player.id);
    if (!previous || signature(previous) !== signature(player)) {
      listeners.forEach((listener) => listener(player));
    }
  }

  currentPlayers = nextPlayers;
}

export function getLocalCityPlayers(): MapPlayer[] {
  return currentPlayers;
}

export function subscribeLocalCityPlayers(listener: (player: MapPlayer) => void) {
  listeners.add(listener);
  // Rejoue l'état courant : un abonné tardif (écran carte monté après le
  // premier publish de CityRuntime) recevait sinon uniquement les diffs
  // suivants et ne voyait qu'une fraction de la ville.
  for (const player of currentPlayers) listener(player);
  return () => listeners.delete(listener);
}

export function clearLocalCityPlayers() {
  publishLocalCityPlayers([]);
}
