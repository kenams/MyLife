import { describe, expect, it } from "vitest";

import { buildMapEvents, eventByLocation } from "@/lib/map-events";
import { createStatsFromAvatar, normalizeStats } from "@/lib/game-engine";

describe("map-events", () => {
  it("prioritizes urgent player needs on actionable city locations", () => {
    const stats = normalizeStats({
      ...createStatsFromAvatar(null),
      hunger: 12,
      energy: 18,
      health: 88,
      hygiene: 80,
      mood: 82,
      money: 160,
    });

    const events = buildMapEvents(stats, 3);

    expect(events[0]).toMatchObject({
      locationSlug: "market",
      severity: "high",
      statKey: "hunger",
    });
    expect(events.some((event) => event.locationSlug === "home")).toBe(true);
  });

  it("keeps only the strongest event per location", () => {
    const stats = normalizeStats({
      ...createStatsFromAvatar(null),
      energy: 10,
      hygiene: 18,
      stress: 90,
      money: 20,
    });

    const byLocation = eventByLocation(buildMapEvents(stats, 6));

    expect(byLocation.home.severity).toBe("high");
    expect(byLocation.spa.severity).toBe("high");
    expect(byLocation.office.title).toBe("Budget serré");
  });
});
