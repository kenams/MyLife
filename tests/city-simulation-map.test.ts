import { describe, expect, it } from "vitest";

import {
  estimateCityActivity,
  livingNpcsToMapPlayers,
  projectNpcPosition,
  selectMaterializedNpcs,
  TOULOUSE_CITY,
} from "@/lib/city-simulation-map";
import { seedLivingCityNpcs } from "@/lib/living-city";

describe("city simulation map projection", () => {
  it("models Toulouse at city scale without instantiating the reference population", () => {
    expect(TOULOUSE_CITY.referencePopulation).toBeGreaterThan(500_000);
    const estimate = estimateCityActivity(new Date("2026-08-29T18:30:00"));
    expect(estimate.referencePopulation).toBe(TOULOUSE_CITY.referencePopulation);
    expect(estimate.awakePopulation).toBeGreaterThan(400_000);
    expect(estimate.mobilePopulation).toBeGreaterThan(100_000);
    expect(estimate.materializedAgents).toBeLessThanOrEqual(240);
    expect(estimate.materializedAgents).toBeGreaterThanOrEqual(80);
  });

  it("keeps QA presets separate from the city population model", () => {
    const npcs = seedLivingCityNpcs("NORMAL", new Date("2026-08-29T12:00:00Z"));
    expect(npcs.length).toBe(200);
    expect(npcs.length).toBeLessThan(TOULOUSE_CITY.referencePopulation);
    expect(estimateCityActivity(new Date("2026-08-29T12:00:00")).referencePopulation).toBe(515_000);
  });

  it("projects NPCs deterministically into plausible Toulouse coordinates", () => {
    const npc = seedLivingCityNpcs("LOW", new Date("2026-08-29T12:00:00Z"))[0];
    const first = projectNpcPosition(npc);
    const second = projectNpcPosition(npc);
    expect(first).toEqual(second);
    expect(first.lat).toBeGreaterThan(43.5);
    expect(first.lat).toBeLessThan(43.7);
    expect(first.lng).toBeGreaterThan(1.3);
    expect(first.lng).toBeLessThan(1.6);
  });

  it("projects Living City activity into useful map labels and statuses", () => {
    const npc = {
      ...seedLivingCityNpcs("LOW", new Date("2026-08-29T12:00:00Z"))[0],
      currentActivity: "mission",
      crewId: null,
      crewTag: null,
      presenceOnline: true,
    };

    const player = livingNpcsToMapPlayers([npc], TOULOUSE_CITY, new Date("2026-08-29T12:00:00Z"), 16)[0];

    expect(player.last_action).toContain("mission");
    expect(player.status).toBe("free");
    expect(player.avatar_emoji).toBe("🎯");
  });

  it("materialises a bounded active subset for the MapLibre pipeline", () => {
    const at = new Date("2026-08-29T20:00:00");
    const npcs = seedLivingCityNpcs("CHAOS", at);
    const selected = selectMaterializedNpcs(npcs, at, TOULOUSE_CITY, 16);
    const projected = livingNpcsToMapPlayers(npcs, TOULOUSE_CITY, at, 16);
    const budget = estimateCityActivity(at, TOULOUSE_CITY, 16).materializedAgents;

    expect(selected.length).toBeLessThanOrEqual(budget);
    expect(projected.length).toBe(selected.length);
    expect(projected.length).toBeLessThan(npcs.length);
    expect(projected.every((p) => p.is_npc && p.location_verified === false)).toBe(true);
    expect(projected.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
  });

  it("changes city rhythm by time of day without changing reference population", () => {
    const night = estimateCityActivity(new Date("2026-08-29T03:00:00"));
    const commute = estimateCityActivity(new Date("2026-08-29T08:15:00"));
    const evening = estimateCityActivity(new Date("2026-08-29T18:30:00"));

    expect(night.referencePopulation).toBe(commute.referencePopulation);
    expect(commute.mobilePopulation).toBeGreaterThan(night.mobilePopulation);
    expect(evening.socialPopulation).toBeGreaterThan(commute.socialPopulation);
  });
});
