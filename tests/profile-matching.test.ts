import { describe, expect, it } from "vitest";

import { getBestProfileMatches } from "@/lib/profile-matching";
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
  interests: ["business", "fitness", "cinema"],
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
    id: "match",
    name: "Ava",
    ageRange: "26-30",
    role: "Coach business",
    locationSlug: "cafe",
    vibe: "ambitieux et calme",
    bio: "Aime le sport, le business et les sorties sobres.",
    interests: ["business", "fitness", "coffee"],
    lookingFor: ["amis", "relation amoureuse"],
    status: "online",
    reputation: 78,
    socialRank: "influent"
  },
  {
    id: "low",
    name: "Noa",
    ageRange: "21-25",
    role: "Artiste",
    locationSlug: "park",
    vibe: "spontane",
    bio: "Profil different.",
    interests: ["art", "musique"],
    lookingFor: ["sorties"],
    status: "recent",
    reputation: 45,
    socialRank: "stable"
  }
];

const relationships: RelationshipRecord[] = [
  {
    residentId: "match",
    status: "ami",
    score: 60,
    quality: "stable",
    influence: "positive",
    lastInteractionAt: "2026-04-18T10:00:00.000Z",
    isFollowing: true
  }
];

describe("profile-matching", () => {
  it("sorts residents by profile compatibility and explains why", () => {
    const [best, second] = getBestProfileMatches(avatar, residents, relationships);

    expect(best.resident.id).toBe("match");
    expect(best.score).toBeGreaterThan(second.score);
    expect(best.tier).toBe("excellent");
    expect(best.intent).toBe("romance");
    expect(best.reasons).toContain("recherche compatible");
  });

  it("keeps matching safe when the avatar profile is missing", () => {
    const [best] = getBestProfileMatches(null, residents, relationships);

    expect(best.score).toBe(60);
    expect(best.tier).toBe("low");
    expect(best.reasons).toEqual(["Complete ton profil pour un vrai matching"]);
  });
});
