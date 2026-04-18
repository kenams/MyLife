import { describe, expect, it } from "vitest";

import { createStatsFromAvatar, normalizeStats } from "@/lib/game-engine";
import { buildSmartNotifications } from "@/lib/smart-notifications";
import type { AvatarProfile, RelationshipRecord, ResidentSeed } from "@/lib/types";

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
  lookingFor: ["amis", "relation amoureuse"],
  friendshipIntent: "Construire un cercle fiable.",
  romanceIntent: "Rencontres sobres.",
  favoriteActivities: ["fitness"],
  favoriteOutings: ["coffee"],
  preferredVibe: "ambitieux",
  appreciatedTraits: ["fiable"],
  starterJob: "support-tech"
};

const residents: ResidentSeed[] = [
  {
    id: "ava",
    name: "Ava",
    ageRange: "26-30",
    role: "Coach business",
    locationSlug: "cafe",
    vibe: "ambitieux",
    bio: "Match social.",
    interests: ["business", "fitness", "coffee"],
    lookingFor: ["amis", "relation amoureuse"],
    status: "online",
    reputation: 80,
    socialRank: "influent"
  }
];

const relationships: RelationshipRecord[] = [
  {
    residentId: "ava",
    status: "ami",
    score: 58,
    quality: "stable",
    influence: "positive",
    lastInteractionAt: "2026-04-18T10:00:00.000Z",
    isFollowing: true
  }
];

describe("smart-notifications", () => {
  it("prioritizes critical needs before social opportunities", () => {
    const stats = normalizeStats({
      ...createStatsFromAvatar(avatar),
      hunger: 12,
      energy: 14,
      hydration: 70,
      hygiene: 80,
      sociability: 80,
      money: 200
    });

    const items = buildSmartNotifications({
      avatar,
      stats,
      relationships,
      residents,
      now: "2026-04-18T10:00:00.000Z"
    });

    expect(items[0].priority).toBe("critical");
    expect(items[0].kind).toBe("needs");
    expect(items.some((item) => item.title === "Match compatible detecte")).toBe(true);
  });

  it("creates a profile match notification when a resident fits the avatar", () => {
    const stats = normalizeStats({
      ...createStatsFromAvatar(avatar),
      hunger: 80,
      energy: 80,
      hydration: 80,
      hygiene: 80,
      sociability: 60,
      money: 150
    });

    const items = buildSmartNotifications({
      avatar,
      stats,
      relationships,
      residents,
      now: "2026-04-18T10:00:00.000Z"
    });

    const match = items.find((item) => item.id === "smart-match-ava");
    expect(match?.kind).toBe("social");
    expect(match?.route).toBe("/(app)/discover");
    expect(match?.body).toContain("Ava");
  });
});
