import { describe, expect, it } from "vitest";

import { livingNpcsToMapPlayers, projectNpcPosition, TOULOUSE_CITY } from "@/lib/city-simulation-map";
import { seedLivingCityNpcs } from "@/lib/living-city";

describe("city simulation map projection", () => {
  it("models Toulouse at city scale without instantiating the reference population", () => {
    expect(TOULOUSE_CITY.referencePopulation).toBeGreaterThan(500_000);
    const npcs = seedLivingCityNpcs("NORMAL", new Date("2026-08-29T12:00:00Z"));
    expect(npcs.length).toBe(100);
    expect(npcs.length).toBeLessThan(TOULOUSE_CITY.referencePopulation);
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

  it("only materialises active NPCs for the MapLibre pipeline", () => {
    const npcs = seedLivingCityNpcs("BUSY", new Date("2026-08-29T20:00:00Z"));
    const projected = livingNpcsToMapPlayers(npcs);
    expect(projected.length).toBe(npcs.filter((npc) => npc.presenceOnline).length);
    expect(projected.every((p) => p.is_npc && p.location_verified === false)).toBe(true);
    expect(projected.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
  });
});
