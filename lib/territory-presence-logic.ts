import { nearestWithin } from "./geo";

type OwnedPlace = {
  center_lat: number;
  center_lng: number;
  owner_crew_id: string | null;
};

/** Territoire courant s'il appartient à un AUTRE crew que le mien (pur, testable). */
export function currentEnemyTerritory<T extends OwnedPlace>(
  loc: { lat: number; lng: number } | null,
  territories: T[],
  myCrewId: string | null
): T | null {
  if (!loc) return null;
  const here = nearestWithin(loc.lat, loc.lng, territories);
  if (!here || !here.owner_crew_id) return null;
  if (myCrewId && here.owner_crew_id === myCrewId) return null;
  return here;
}
