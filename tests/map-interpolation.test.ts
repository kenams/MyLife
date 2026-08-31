import { describe, expect, it } from "vitest";

import { createTweenStore } from "@/lib/map-interpolation";
import type { MapPlayer } from "@/lib/life-map";

function player(id: string, lat: number, lng: number, isNpc = true): MapPlayer {
  return {
    id, user_id: id, display_name: id, avatar_emoji: "🧑", status: "free",
    lat, lng, location_name: null, location_verified: false, last_action: null,
    is_star: false, is_npc: isNpc, level: 1, crew_color: null, crew_tag: null,
    updated_at: new Date().toISOString(),
  };
}

describe("map-interpolation tween store", () => {
  it("interpole progressivement une position PNJ vers sa cible", () => {
    const s = createTweenStore(1000);
    s.retarget([player("a", 43.60, 1.44)], 0);
    s.retarget([player("a", 43.62, 1.44)], 0); // nouvelle cible à t=0

    const mid = s.sample(500).find((p) => p.id === "a")!;
    expect(mid.lat).toBeGreaterThan(43.60);
    expect(mid.lat).toBeLessThan(43.62);

    const end = s.sample(2000).find((p) => p.id === "a")!;
    expect(end.lat).toBeCloseTo(43.62, 5);
  });

  it("ne lisse jamais un vrai joueur (is_npc = false)", () => {
    const s = createTweenStore(1000);
    s.retarget([player("me", 43.60, 1.44, false)], 0);
    s.retarget([player("me", 43.99, 1.99, false)], 0);
    const now = s.sample(100).find((p) => p.id === "me")!;
    expect(now.lat).toBe(43.99);
    expect(now.lng).toBe(1.99);
  });

  it("oublie les pistes disparues et conserve l'ordre d'entrée", () => {
    const s = createTweenStore(500);
    s.retarget([player("a", 1, 1), player("b", 2, 2)], 0);
    expect(s.size()).toBe(2);
    const out = s.retarget([player("b", 2, 2)], 0);
    void out;
    const sample = s.sample(0);
    expect(sample.map((p) => p.id)).toEqual(["b"]);
    expect(s.size()).toBe(1);
  });

  it("hasMoving repasse à false une fois les cibles atteintes", () => {
    const s = createTweenStore(1000);
    s.retarget([player("a", 0, 0)], 0);
    s.retarget([player("a", 1, 1)], 0);
    expect(s.hasMoving(10)).toBe(true);
    s.sample(5000);
    expect(s.hasMoving(5000)).toBe(false);
  });
});
