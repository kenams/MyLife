import { useEffect, useRef, useState } from "react";

import type { MapPlayer } from "@/lib/life-map";

/**
 * Lissage visuel global des positions PNJ.
 *
 * La simulation Living City publie des positions cibles toutes les ~15 s. Sans
 * lissage, les marqueurs "sautent". Ce hook maintient UN SEUL timer global (pas
 * un timer par PNJ) qui interpole chaque marqueur de sa position affichée vers
 * sa dernière position publiée sur EASE_MS. Les vrais joueurs (is_npc = false)
 * ne sont pas lissés : leur position vient du GPS et doit rester exacte.
 */

const EASE_MS = 2600;
const FRAME_MS = 90;
const EPS = 1e-7;

type Track = { sLat: number; sLng: number; tLat: number; tLng: number; cLat: number; cLng: number; t0: number };

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

export function useInterpolatedPlayers(targets: MapPlayer[]): MapPlayer[] {
  const tracks = useRef<Map<string, Track>>(new Map());
  const [, force] = useState(0);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  // Réconcilie les pistes avec la dernière liste publiée.
  useEffect(() => {
    const now = Date.now();
    const seen = new Set<string>();
    for (const p of targets) {
      seen.add(p.id);
      const existing = tracks.current.get(p.id);
      if (!existing) {
        tracks.current.set(p.id, { sLat: p.lat, sLng: p.lng, tLat: p.lat, tLng: p.lng, cLat: p.lat, cLng: p.lng, t0: now });
      } else if (Math.abs(existing.tLat - p.lat) > EPS || Math.abs(existing.tLng - p.lng) > EPS) {
        existing.sLat = existing.cLat;
        existing.sLng = existing.cLng;
        existing.tLat = p.lat;
        existing.tLng = p.lng;
        existing.t0 = now;
      }
    }
    for (const id of tracks.current.keys()) {
      if (!seen.has(id)) tracks.current.delete(id);
    }
    force((n) => n + 1);
  }, [targets]);

  // Timer global unique.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      let moving = false;
      const now = Date.now();
      for (const track of tracks.current.values()) {
        const k = easeOutCubic(Math.min(1, (now - track.t0) / EASE_MS));
        const nLat = track.sLat + (track.tLat - track.sLat) * k;
        const nLng = track.sLng + (track.tLng - track.sLng) * k;
        if (Math.abs(nLat - track.cLat) > EPS || Math.abs(nLng - track.cLng) > EPS) {
          track.cLat = nLat;
          track.cLng = nLng;
          moving = true;
        }
      }
      if (moving) force((n) => n + 1);
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  return targets.map((p) => {
    if (!p.is_npc) return p;
    const track = tracks.current.get(p.id);
    if (!track) return p;
    return { ...p, lat: track.cLat, lng: track.cLng };
  });
}
