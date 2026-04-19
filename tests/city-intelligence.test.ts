import { describe, expect, it } from "vitest";

import { buildCityIntel } from "@/lib/city-intelligence";
import { createStatsFromAvatar, normalizeStats } from "@/lib/game-engine";
import type { AvatarProfile, NpcState, RelationshipRecord } from "@/lib/types";

const avatar: AvatarProfile = {
  displayName: "Kenan",
  ageRange: "26-30",
  gender: "Homme",
  originStyle: "Mixte",
  photoStyle: "Street premium",
  bio: "Profil test",
  heightCm: 178,
  weightKg: 74,
  bodyFrame: "athletique",
  skinTone: "ambre",
  hairType: "ondule",
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
  lookingFor: ["amis"],
  friendshipIntent: "Construire un cercle fiable.",
  romanceIntent: "Rencontres sobres.",
  favoriteActivities: ["fitness"],
  favoriteOutings: ["coffee"],
  preferredVibe: "ambitieux",
  appreciatedTraits: ["fiable"],
  starterJob: "support-tech"
};

function npc(id: string, locationSlug: string, online = true): NpcState {
  return {
    id,
    name: id === "ava" ? "Ava" : "Noa",
    locationSlug,
    action: "chatting",
    mood: 80,
    energy: 70,
    hunger: 70,
    stress: 20,
    hygiene: 80,
    money: 100,
    xp: 0,
    level: 1,
    reputation: 40,
    streak: 0,
    lastTickAt: "2026-04-19T10:00:00.000Z",
    lastMessageAt: null,
    lastInviteAt: null,
    posX: 50,
    posY: 50,
    presenceOnline: online,
    lastOnlineAt: null
  };
}

const relationships: RelationshipRecord[] = [
  {
    residentId: "ava",
    status: "ami",
    score: 62,
    quality: "stable",
    influence: "positive",
    lastInteractionAt: "2026-04-19T10:00:00.000Z",
    isFollowing: true
  }
];

describe("city-intelligence", () => {
  it("sends the player to the market when vital needs are low", () => {
    const plan = buildCityIntel({
      stats: normalizeStats({ ...createStatsFromAvatar(avatar), hunger: 12, hydration: 80 }),
      currentLocationSlug: "cafe",
      npcs: [npc("ava", "cafe")],
      livePlayers: [],
      relationships
    });

    expect(plan.locationSlug).toBe("market");
    expect(plan.action).toBe("healthy-meal");
    expect(plan.urgency).toBe("critical");
  });

  it("recommends the best online social target when the player is stable", () => {
    const plan = buildCityIntel({
      stats: normalizeStats({ ...createStatsFromAvatar(avatar), hunger: 80, energy: 80, hygiene: 80, money: 160, sociability: 65 }),
      currentLocationSlug: "home",
      npcs: [npc("ava", "cafe"), npc("noa", "park")],
      livePlayers: [],
      relationships
    });

    expect(plan.locationSlug).toBe("cafe");
    expect(plan.action).toBe("cafe-chat");
    expect(plan.targetName).toBe("Ava");
  });

  it("uses the player's residential district for recovery needs", () => {
    const plan = buildCityIntel({
      stats: normalizeStats({ ...createStatsFromAvatar(avatar), hunger: 80, energy: 12, hygiene: 80, money: 160 }),
      currentLocationSlug: "office",
      npcs: [],
      livePlayers: [],
      relationships,
      housingTier: "villa"
    });

    expect(plan.locationSlug).toBe("residence-luxe");
    expect(plan.action).toBe("rest-home");
  });
});
