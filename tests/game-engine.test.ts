import { describe, expect, it, vi } from "vitest";

import {
  applyDecay,
  createStatsFromAvatar,
  getDateReadiness,
  normalizeStats,
  seededRelationships
} from "@/lib/game-engine";
import type { AvatarProfile } from "@/lib/types";

const avatar: AvatarProfile = {
  displayName: "Test",
  ageRange: "26-30",
  gender: "Homme",
  originStyle: "Mixte",
  photoStyle: "Street premium",
  bio: "Profil test",
  heightCm: 178,
  weightKg: 74,
  bodyFrame: "athletique",
  skinTone: "ambre",
  hairType: "ondulé",
  hairColor: "noir",
  hairLength: "court",
  eyeColor: "marron",
  outfitStyle: "business",
  facialHair: "barbe courte",
  silhouette: "tonique",
  personalityTrait: "Strategique",
  sociabilityStyle: "ouvert",
  ambition: "croissance",
  lifeRhythm: "equilibre",
  interests: ["business", "fitness"],
  leisureStyles: ["fitness"],
  relationshipStyle: "stable",
  personalGoal: "monter socialement",
  lifeHabit: "structure",
  lookingFor: ["amis", "relation amoureuse"],
  friendshipIntent: "Construire un cercle fiable.",
  romanceIntent: "Rencontres sobres et publiques.",
  favoriteActivities: ["fitness"],
  favoriteOutings: ["coffee"],
  preferredVibe: "ambitieux",
  appreciatedTraits: ["fiable"],
  starterJob: "support-tech"
};

describe("game-engine", () => {
  it("clamps core stats and recomputes derived values", () => {
    const stats = normalizeStats({
      ...createStatsFromAvatar(avatar),
      hunger: 140,
      hydration: -20,
      stress: 160,
      money: -50,
      weight: 300
    });

    expect(stats.hunger).toBe(100);
    expect(stats.hydration).toBe(0);
    expect(stats.stress).toBe(100);
    expect(stats.money).toBe(0);
    expect(stats.weight).toBe(180);
    expect(stats.socialRankScore).toBeGreaterThanOrEqual(0);
    expect(stats.attractiveness).toBeGreaterThanOrEqual(0);
  });

  it("applies time decay after enough elapsed time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00.000Z"));

    const stats = normalizeStats({
      ...createStatsFromAvatar(avatar),
      hunger: 80,
      hydration: 80,
      energy: 80,
      lastDecayAt: "2026-04-16T09:00:00.000Z"
    });

    const decayed = applyDecay(stats);

    expect(decayed.hunger).toBeLessThan(stats.hunger);
    expect(decayed.hydration).toBeLessThan(stats.hydration);
    expect(decayed.energy).toBeLessThan(stats.energy);
    expect(decayed.lastDecayAt).toBe("2026-04-16T12:00:00.000Z");

    vi.useRealTimers();
  });

  it("requires a romantic-compatible resident and enough relationship quality for dates", () => {
    const stats = normalizeStats({
      ...createStatsFromAvatar(avatar),
      hygiene: 75,
      mood: 72,
      sociability: 70,
      energy: 70,
      stress: 25
    });

    const relationships = seededRelationships();
    const noa = relationships.find((item) => item.residentId === "noa");
    const ava = relationships.find((item) => item.residentId === "ava");

    expect(getDateReadiness(stats, ava, "ava").allowed).toBe(false);
    expect(getDateReadiness(stats, { ...noa!, score: 50 }, "noa").allowed).toBe(true);
  });
});
