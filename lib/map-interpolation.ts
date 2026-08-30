import type { MapPlayer } from "@/lib/life-map";

/**
 * Moteur de lissage visuel des positions — PARTAGÉ web / natif.
 *
 * Aucune dépendance DOM, MapLibre, React Native ou React. La simulation publie
 * des positions cibles toutes les ~3 s ; ce store interpole chaque habitant
 * simulé vers sa cible sur EASE_MS. Le renderer appelle `sample(now)` à sa
 * cadence (rAF côté web, setInterval côté natif) — un SEUL point d'appel
 * global, jamais un timer par marqueur.
 *
 * Les vrais joueurs (is_npc = false) ne sont jamais lissés : leur position
 * vient du GPS et doit rester exacte.
 */

export const TWEEN_EASE_MS = 2600;
const EPS = 1e-7;

type Track = {
  sLat: number; sLng: number;
  tLat: number; tLng: number;
  cLat: number; cLng: number;
  t0: number;
};

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
}

export type TweenStore = {
  /** Reçoit la dernière liste publiée : (re)cible les pistes concernées. */
  retarget: (players: MapPlayer[], now?: number) => void;
  /** Positions interpolées à l'instant `now`. Conserve l'ordre d'entrée. */
  sample: (now?: number) => MapPlayer[];
  /** true tant qu'au moins une piste n'a pas atteint sa cible. */
  hasMoving: (now?: number) => boolean;
  /** Nombre de pistes suivies (debug/tests). */
  size: () => number;
};

export function createTweenStore(easeMs: number = TWEEN_EASE_MS): TweenStore {
  const tracks = new Map<string, Track>();
  let lastInput: MapPlayer[] = [];

  function retarget(players: MapPlayer[], now: number = Date.now()) {
    lastInput = players;
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.id);
      const cur = tracks.get(p.id);
      if (!cur) {
        tracks.set(p.id, { sLat: p.lat, sLng: p.lng, tLat: p.lat, tLng: p.lng, cLat: p.lat, cLng: p.lng, t0: now });
      } else if (Math.abs(cur.tLat - p.lat) > EPS || Math.abs(cur.tLng - p.lng) > EPS) {
        cur.sLat = cur.cLat;
        cur.sLng = cur.cLng;
        cur.tLat = p.lat;
        cur.tLng = p.lng;
        cur.t0 = now;
      }
    }
    for (const id of [...tracks.keys()]) {
      if (!seen.has(id)) tracks.delete(id);
    }
  }

  function advance(now: number) {
    for (const tr of tracks.values()) {
      const k = easeOutCubic((now - tr.t0) / easeMs);
      tr.cLat = tr.sLat + (tr.tLat - tr.sLat) * k;
      tr.cLng = tr.sLng + (tr.tLng - tr.sLng) * k;
    }
  }

  function sample(now: number = Date.now()): MapPlayer[] {
    advance(now);
    return lastInput.map((p) => {
      if (!p.is_npc) return p;
      const tr = tracks.get(p.id);
      if (!tr) return p;
      return { ...p, lat: tr.cLat, lng: tr.cLng };
    });
  }

  function hasMoving(now: number = Date.now()): boolean {
    for (const tr of tracks.values()) {
      if ((now - tr.t0) < easeMs && (Math.abs(tr.tLat - tr.cLat) > EPS || Math.abs(tr.tLng - tr.cLng) > EPS)) {
        return true;
      }
    }
    return false;
  }

  return { retarget, sample, hasMoving, size: () => tracks.size };
}
