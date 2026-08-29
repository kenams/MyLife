import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import {
  createLivingCityState,
  populationForPreset,
  seedLivingCityNpcs,
  simulateLivingCityTick,
} from "@/lib/living-city";

describe("living city simulation", () => {
  it("seeds the QA population presets", () => {
    expect(populationForPreset("LOW")).toBe(30);
    expect(populationForPreset("NORMAL")).toBe(100);
    expect(populationForPreset("BUSY")).toBe(250);

    const busy = seedLivingCityNpcs("BUSY", new Date("2026-08-29T20:00:00Z"));
    expect(busy).toHaveLength(250);
    expect(busy.every((npc) => npc.is_npc && npc.is_demo && !npc.is_qa)).toBe(true);
    expect(new Set(busy.map((npc) => npc.personality)).size).toBeGreaterThan(10);
  });

  it("ticks in batches and keeps notifications credible", () => {
    const now = new Date("2026-08-29T20:00:00Z");
    const state = createLivingCityState("BUSY");
    const npcs = seedLivingCityNpcs("BUSY", now);

    const result = simulateLivingCityTick({
      state,
      npcs,
      now: new Date("2026-08-29T20:10:00Z"),
      playerDistrict: "Capitole",
    });

    expect(result.npcs).toHaveLength(250);
    expect(result.feed.length).toBeGreaterThan(0);
    expect(result.notifications.length).toBeLessThanOrEqual(2);
    expect(result.state.notificationsLastMinute).toBe(result.notifications.length);
    expect(result.state.avgTickMs).toBeGreaterThan(0);
  });

  it("summarizes offline simulation without per-second heartbeats", () => {
    const base = new Date("2026-08-29T08:00:00Z");
    const state = {
      ...createLivingCityState("NORMAL"),
      lastSimulatedAt: base.toISOString(),
      speed: 5 as const,
    };
    const result = simulateLivingCityTick({
      state,
      npcs: seedLivingCityNpcs("NORMAL", base),
      now: new Date("2026-08-29T11:00:00Z"),
    });

    expect(result.state.tick).toBe(1);
    expect(result.state.lastAbsenceSummary.length).toBeGreaterThan(0);
    expect(result.feed.length).toBeLessThanOrEqual(6);
  });

  it("keeps LOW, NORMAL and BUSY presets cheap enough for local QA", () => {
    const benchmarkPreset = (preset: "LOW" | "NORMAL" | "BUSY") => {
      let state = createLivingCityState(preset);
      let npcs = seedLivingCityNpcs(preset, new Date("2026-08-29T12:00:00Z"));
      const started = performance.now();

      for (let i = 0; i < 20; i++) {
        const result = simulateLivingCityTick({
          state,
          npcs,
          now: new Date(Date.UTC(2026, 7, 29, 12, i + 1, 0)),
          playerDistrict: "Capitole",
          forceMinutes: 10,
        });
        state = result.state;
        npcs = result.npcs;
      }

      return Number(((performance.now() - started) / 20).toFixed(2));
    };

    const timings = {
      LOW: benchmarkPreset("LOW"),
      NORMAL: benchmarkPreset("NORMAL"),
      BUSY: benchmarkPreset("BUSY"),
    };
    console.info("living-city perf ms/tick", timings);

    expect(timings.LOW).toBeLessThan(20);
    expect(timings.NORMAL).toBeLessThan(35);
    expect(timings.BUSY).toBeLessThan(60);
  });

  it("can force event kinds from the QA panel actions", () => {
    const result = simulateLivingCityTick({
      state: createLivingCityState("NORMAL"),
      npcs: seedLivingCityNpcs("NORMAL", new Date("2026-08-29T20:00:00Z")),
      now: new Date("2026-08-29T20:10:00Z"),
      forceKind: "TERRITORY",
    });

    expect(result.feed[0]?.title).toBe("Territoires");
    expect(result.state.events[0]?.kind).toBe("TERRITORY");
  });
});
