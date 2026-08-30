import { describe, expect, it } from "vitest";

import { pickSpontaneousNpcMoment, SPONTANEOUS_COOLDOWN_MS } from "@/lib/npc-spontaneous";
import { seedLivingCityNpcs } from "@/lib/living-city";
import type { LivingCityEvent } from "@/lib/living-city";

const npcs = seedLivingCityNpcs("LOW", new Date("2026-08-30T18:00:00Z"));

function ev(partial: Partial<LivingCityEvent>): LivingCityEvent {
  return {
    id: "e1",
    kind: "SOCIAL",
    title: "Social",
    body: "",
    district: "Capitole",
    at: "2026-08-30T18:00:00Z",
    priority: 70,
    notify: false,
    actorNpcIds: [npcs[0].id],
    crewIds: [],
    ...partial,
  };
}

describe("npc-spontaneous", () => {
  const now = new Date("2026-08-30T18:00:00Z");

  it("propose au plus un moment et respecte le cooldown", () => {
    const events = [ev({ kind: "SOCIAL" }), ev({ id: "e2", kind: "OUTING", actorNpcIds: [npcs[1].id] })];
    const first = pickSpontaneousNpcMoment(events, npcs, {
      playerDistrict: "Capitole", playerLevel: 3, lastMomentAt: null, recentMomentIds: [],
    }, now);
    expect(first).not.toBeNull();
    expect(first!.simulated).toBe(true);

    const blocked = pickSpontaneousNpcMoment(events, npcs, {
      playerDistrict: "Capitole", playerLevel: 3,
      lastMomentAt: new Date(now.getTime() - SPONTANEOUS_COOLDOWN_MS + 10_000).toISOString(),
      recentMomentIds: [],
    }, now);
    expect(blocked).toBeNull();
  });

  it("priorise un événement du quartier du joueur", () => {
    const events = [
      ev({ id: "far", kind: "OUTING", district: "Rangueil", priority: 80, actorNpcIds: [npcs[2].id] }),
      ev({ id: "near", kind: "OUTING", district: "Capitole", priority: 60, actorNpcIds: [npcs[3].id] }),
    ];
    const moment = pickSpontaneousNpcMoment(events, npcs, {
      playerDistrict: "Capitole", playerLevel: 3, lastMomentAt: null, recentMomentIds: [],
    }, now);
    expect(moment!.district).toBe("Capitole");
  });

  it("dégrade CREW en simple salut si le joueur est niveau 1", () => {
    const events = [ev({ kind: "CREW", actorNpcIds: [npcs[0].id] })];
    const moment = pickSpontaneousNpcMoment(events, npcs, {
      playerDistrict: "Capitole", playerLevel: 1, lastMomentAt: null, recentMomentIds: [],
    }, now);
    expect(moment!.kind).toBe("GREETING");
  });

  it("dédoublonne via recentMomentIds", () => {
    const events = [ev({ kind: "SOCIAL" })];
    const id = pickSpontaneousNpcMoment(events, npcs, {
      playerDistrict: "Capitole", playerLevel: 3, lastMomentAt: null, recentMomentIds: [],
    }, now)!.id;
    const again = pickSpontaneousNpcMoment(events, npcs, {
      playerDistrict: "Capitole", playerLevel: 3, lastMomentAt: null, recentMomentIds: [id],
    }, now);
    expect(again).toBeNull();
  });
});
