/** Helpers géo purs (testables). */

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rayon de « présence » dans un quartier (m). Volontairement large et flou. */
export const TERRITORY_RADIUS_M = 700;

export type Placed = { center_lat: number; center_lng: number };

/** Quartier courant = le plus proche dont le centre est à moins de TERRITORY_RADIUS_M. */
export function nearestWithin<T extends Placed>(
  lat: number,
  lng: number,
  items: T[],
  radius = TERRITORY_RADIUS_M
): T | null {
  let best: T | null = null;
  let bestD = radius;
  for (const it of items) {
    const d = haversineMeters(lat, lng, it.center_lat, it.center_lng);
    if (d <= bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}
