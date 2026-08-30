import { describe, expect, it } from "vitest";

import {
  DISTRICT_ANCHORS,
  districtDistanceKm,
  isTraveling,
  planTrip,
  tripProgress,
  travelActivityLabel,
  travelPosition,
} from "@/lib/npc-travel";
import { seedLivingCityNpcs, simulateLivingCityTick, createLivingCityState } from "@/lib/living-city";
import { livingNpcsToMapPlayers } from "@/lib/city-simulation-map";
import type { NpcState } from "@/lib/types";

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const baseNpc: NpcState = {
  ...seedLivingCityNpcs("LOW", new Date("2026-08-30T08:00:00Z"))[0],
  id: "npc-travel-test",
  homeDistrictSlug: "Capitole",
  currentDistrictSlug: "Capitole",
};

describe("npc-travel", () => {
  it("computes a stable distance between district anchors", () => {
    expect(districtDistanceKm("Capitole", "Capitole")).toBe(0);
    const d = districtDistanceKm("Capitole", "Rangueil");
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(6);
  });

  it("plans a trip toward the work district and never a zero-length trip", () => {
    const trip = planTrip(baseNpc, "working", new Date("2026-08-30T08:00:00Z"), seededRng(7));
    if (trip) {
      expect(trip.originDistrictSlug).toBe("Capitole");
      expect(trip.destDistrictSlug).not.toBe("Capitole");
      expect(DISTRICT_ANCHORS[trip.destDistrictSlug]).toBeDefined();
      expect(new Date(trip.travelEndsAt).getTime()).toBeGreaterThan(new Date(trip.travelStartedAt).getTime());
    }
  });

  it("returns null when the NPC is already in the right district", () => {
    const homebody: NpcState = { ...baseNpc, currentDistrictSlug: "Capitole" };
    expect(planTrip(homebody, "sleeping", new Date("2026-08-30T23:00:00Z"), seededRng(1))).toBeNull();
  });

  it("interpolates position between origin and destination over the trip window", () => {
    const start = new Date("2026-08-30T08:00:00Z");
    const npc: NpcState = {
      ...baseNpc,
      originDistrictSlug: "Capitole",
      destDistrictSlug: "Rangueil",
      travelMode: "METRO",
      travelStartedAt: start.toISOString(),
      travelEndsAt: new Date(start.getTime() + 10 * 60_000).toISOString(),
    };
    expect(tripProgress(npc, start)).toBe(0);
    const mid = travelPosition(npc, new Date(start.getTime() + 5 * 60_000))!;
    const a = DISTRICT_ANCHORS.Capitole;
    const b = DISTRICT_ANCHORS.Rangueil;
    expect(mid.lat).toBeGreaterThan(Math.min(a.lat, b.lat) - 0.01);
    expect(mid.lat).toBeLessThan(Math.max(a.lat, b.lat) + 0.01);
    expect(isTraveling(npc, new Date(start.getTime() + 5 * 60_000))).toBe(true);
    expect(isTraveling(npc, new Date(start.getTime() + 20 * 60_000))).toBe(false);
  });

  it("labels transit legs with a destination and a mode emoji", () => {
    const label = travelActivityLabel("METRO", "Jean-Jaures");
    expect(label).toContain("🚇");
    expect(label).toContain("Jean Jaures");
  });
});

describe("living-city produces visible movement", () => {
  it("advances NPC map positions between two consecutive projections", () => {
    const t0 = new Date("2026-08-30T18:00:00Z");
    const state = createLivingCityState("NORMAL");
    let npcs = seedLivingCityNpcs("NORMAL", t0);

    // deux ticks de simulation à 3 minutes d'intervalle
    const r1 = simulateLivingCityTick({ state, npcs, now: t0, playerDistrict: "Capitole" });
    npcs = r1.npcs;
    const r2 = simulateLivingCityTick({
      state: r1.state,
      npcs,
      now: new Date(t0.getTime() + 3 * 60_000),
      playerDistrict: "Capitole",
    });
    npcs = r2.npcs;

    const before = livingNpcsToMapPlayers(npcs, undefined, new Date(t0.getTime() + 3 * 60_000), 14);
    const after = livingNpcsToMapPlayers(npcs, undefined, new Date(t0.getTime() + 5 * 60_000), 14);

    const beforeById = new Map(before.map((p) => [p.id, p]));
    let moved = 0;
    for (const p of after) {
      const b = beforeById.get(p.id);
      if (!b) continue;
      if (Math.abs(b.lat - p.lat) > 1e-6 || Math.abs(b.lng - p.lng) > 1e-6) moved += 1;
    }
    // au moins quelques habitants doivent avoir bougé uniquement parce que
    // l'horloge a avancé (interpolation de trajet), sans nouveau tick sim.
    expect(moved).toBeGreaterThan(3);
  });

  it("keeps a bounded, non-empty materialised city at city zoom", () => {
    const at = new Date("2026-08-30T19:00:00Z");
    const npcs = seedLivingCityNpcs("NORMAL", at);
    const players = livingNpcsToMapPlayers(npcs, undefined, at, 13);
    expect(players.length).toBeGreaterThan(80);
    expect(players.length).toBeLessThanOrEqual(240);
  });

  it("exposes a variety of activities, not one repeated state", () => {
    const at = new Date("2026-08-30T12:30:00Z");
    const state = createLivingCityState("NORMAL");
    const seeded = seedLivingCityNpcs("NORMAL", at);
    const ticked = simulateLivingCityTick({ state, npcs: seeded, now: at, playerDistrict: "Capitole" });
    const players = livingNpcsToMapPlayers(ticked.npcs, undefined, at, 14);
    const activities = new Set(players.map((p) => p.last_action));
    expect(activities.size).toBeGreaterThan(3);
  });
});
