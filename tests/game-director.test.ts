import { describe, expect, it } from "vitest";

import { getGameDirectorPlan } from "@/lib/game-director";
import { createStatsFromAvatar, normalizeStats } from "@/lib/game-engine";
import type { AvatarProfile } from "@/lib/types";

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
  interests: ["business"],
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

describe("game-director", () => {
  it("prioritizes critical needs before social or work", () => {
    const plan = getGameDirectorPlan(normalizeStats({
      ...createStatsFromAvatar(avatar),
      hunger: 10,
      energy: 60,
      hygiene: 70
    }), [{ label: "Parler", completed: false }]);

    expect(plan.tone).toBe("danger");
    expect(plan.action).toBe("healthy-meal");
  });

  it("recommends social recovery when sociability is low", () => {
    const plan = getGameDirectorPlan(normalizeStats({
      ...createStatsFromAvatar(avatar),
      hunger: 80,
      energy: 80,
      hygiene: 80,
      sociability: 20
    }), []);

    expect(plan.tone).toBe("social");
    expect(plan.action).toBe("cafe-chat");
  });
});
