import { describe, expect, it } from "vitest";

import { haversineMeters, nearestWithin } from "@/lib/geo";
import { currentEnemyTerritory } from "@/lib/territory-presence-logic";
import type { Territory } from "@/lib/territories";

describe("haversineMeters", () => {
  it("≈ 0 pour le même point", () => {
    expect(haversineMeters(43.6, 1.44, 43.6, 1.44)).toBeLessThan(1);
  });
  it("distance Capitole → Compans ≈ 1,3 km (±300 m)", () => {
    const d = haversineMeters(43.6045, 1.4442, 43.6112, 1.4322);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1700);
  });
});

describe("nearestWithin", () => {
  const pts = [
    { id: "a", center_lat: 43.60, center_lng: 1.44 },
    { id: "b", center_lat: 43.61, center_lng: 1.45 },
  ];
  it("renvoie le point le plus proche dans le rayon", () => {
    expect(nearestWithin(43.601, 1.441, pts)?.id).toBe("a");
  });
  it("renvoie null hors rayon", () => {
    expect(nearestWithin(43.9, 1.9, pts)).toBeNull();
  });
});

describe("currentEnemyTerritory (safe-by-design)", () => {
  const terr = (over: Partial<Territory>): Territory => ({
    id: "t", district_id: "d", district_name: "Capitole", district_emoji: "🏛️",
    center_lat: 43.6045, center_lng: 1.4442, owner_crew_id: null, owner_tag: null,
    owner_name: null, owner_emoji: null, owner_color: null, influence: 50, prestige: 1,
    conquered_at: null, defenses_won: 0, next_battle_at: null, ...over,
  });

  it("null si le territoire est neutre", () => {
    expect(currentEnemyTerritory({ lat: 43.6045, lng: 1.4442 }, [terr({})], "me")).toBeNull();
  });
  it("null si c'est mon propre territoire", () => {
    expect(currentEnemyTerritory({ lat: 43.6045, lng: 1.4442 }, [terr({ owner_crew_id: "me" })], "me")).toBeNull();
  });
  it("renvoie le territoire s'il est à un crew rival", () => {
    const r = currentEnemyTerritory({ lat: 43.6045, lng: 1.4442 }, [terr({ owner_crew_id: "them" })], "me");
    expect(r?.owner_crew_id).toBe("them");
  });
  it("null sans localisation", () => {
    expect(currentEnemyTerritory(null, [terr({ owner_crew_id: "them" })], "me")).toBeNull();
  });
});
