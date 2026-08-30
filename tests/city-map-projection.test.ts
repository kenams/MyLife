import { describe, expect, it } from "vitest";

import { budgetForDevice, projectCityResidents, projectResident } from "@/lib/city-map-projection";
import { seedLivingCityNpcs, simulateLivingCityTick, createLivingCityState } from "@/lib/living-city";

describe("city-map-projection (couche partagée web/natif)", () => {
  const at = new Date("2026-08-30T18:30:00Z");
  const npcs = seedLivingCityNpcs("NORMAL", at);

  it("budget adaptatif selon l'appareil, borné", () => {
    const low = budgetForDevice("low", at);
    const std = budgetForDevice("standard", at);
    const desk = budgetForDevice("desktop", at);
    expect(low).toBeLessThanOrEqual(140);
    expect(std).toBeLessThanOrEqual(220);
    expect(desk).toBeLessThanOrEqual(240);
    expect(low).toBeGreaterThan(40);
    expect(std).toBeGreaterThanOrEqual(low);
  });

  it("projette une population bornée et non vide au zoom ville", () => {
    const residents = projectCityResidents(npcs, at, { zoom: 13 });
    expect(residents.length).toBeGreaterThan(80);
    expect(residents.length).toBeLessThanOrEqual(240);
    expect(residents.every((r) => r.isNpc && Number.isFinite(r.lat) && Number.isFinite(r.lng))).toBe(true);
  });

  it("respecte un cap explicite (device faible)", () => {
    const residents = projectCityResidents(npcs, at, { zoom: 13, cap: 120 });
    expect(residents.length).toBeLessThanOrEqual(120);
  });

  it("expose les champs de déplacement structurés pour les 2 renderers", () => {
    const state = createLivingCityState("NORMAL");
    const ticked = simulateLivingCityTick({ state, npcs, now: at, playerDistrict: "Capitole" });
    const residents = projectCityResidents(ticked.npcs, at, { zoom: 14 });
    const traveling = residents.filter((r) => r.travelMode != null);
    expect(traveling.length).toBeGreaterThan(0);
    for (const r of traveling) {
      expect(["WALK", "BIKE", "CAR", "BUS", "METRO", "TRAM"]).toContain(r.travelMode);
      expect(typeof r.destination === "string" || r.destination === null).toBe(true);
    }
  });

  it("projection déterministe pour un même NpcState + instant", () => {
    const a = projectResident(npcs[0], at);
    const b = projectResident(npcs[0], at);
    expect(a).toEqual(b);
  });
});
