import type { AvatarProfile, RelationshipRecord, ResidentSeed } from "@/lib/types";

export type ResidentMatch = {
  resident: ResidentSeed;
  score: number;
  tier: "excellent" | "strong" | "good" | "low";
  reasons: string[];
  intent: "friendship" | "romance" | "network" | "activity";
};

function sharedCount(a: string[] = [], b: string[] = []) {
  const left = new Set(a.map((item) => item.toLowerCase()));
  return b.filter((item) => left.has(item.toLowerCase())).length;
}

function hasAny(items: string[] | undefined, words: string[]) {
  const source = (items ?? []).join(" ").toLowerCase();
  return words.some((word) => source.includes(word));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function tierFor(score: number): ResidentMatch["tier"] {
  if (score >= 82) return "excellent";
  if (score >= 68) return "strong";
  if (score >= 50) return "good";
  return "low";
}

function intentFor(avatar: AvatarProfile | null, resident: ResidentSeed): ResidentMatch["intent"] {
  if (hasAny(avatar?.lookingFor, ["relation", "amoureuse", "romance"]) && hasAny(resident.lookingFor, ["relation", "amoureuse"])) {
    return "romance";
  }
  if (hasAny(avatar?.interests, ["business", "networking", "work"]) || hasAny(resident.interests, ["business", "systems", "productivity", "tech"])) {
    return "network";
  }
  if (hasAny(avatar?.favoriteActivities, ["fitness", "sport", "gym"]) || hasAny(resident.lookingFor, ["sport", "sorties"])) {
    return "activity";
  }
  return "friendship";
}

export function computeResidentMatch(
  avatar: AvatarProfile | null,
  resident: ResidentSeed,
  relationship?: RelationshipRecord
): ResidentMatch {
  if (!avatar) {
    return {
      resident,
      score: relationship?.score ?? 35,
      tier: "low",
      reasons: ["Complete ton profil pour un vrai matching"],
      intent: "friendship"
    };
  }

  const sharedInterests = sharedCount(avatar.interests, resident.interests);
  const sharedIntent = sharedCount(avatar.lookingFor, resident.lookingFor);
  const activityFit = sharedCount([...(avatar.favoriteActivities ?? []), ...(avatar.favoriteOutings ?? [])], resident.interests);
  const preferredVibe = (avatar.preferredVibe ?? "").trim().toLowerCase();
  const lifestyleFit = preferredVibe.length > 0 && resident.vibe.toLowerCase().includes(preferredVibe) ? 1 : 0;
  const relationshipBoost = relationship ? Math.min(16, Math.round(relationship.score / 6)) : 0;
  const reputationBoost = resident.reputation >= 70 ? 6 : resident.reputation >= 55 ? 3 : 0;

  const romanceFit =
    hasAny(avatar.lookingFor, ["relation", "amoureuse"]) && hasAny(resident.lookingFor, ["relation", "amoureuse"])
      ? 12
      : 0;

  const score = clampScore(
    28 +
    sharedInterests * 12 +
    sharedIntent * 10 +
    activityFit * 8 +
    lifestyleFit * 6 +
    relationshipBoost +
    reputationBoost +
    romanceFit
  );

  const reasons: string[] = [];
  if (sharedInterests > 0) reasons.push(`${sharedInterests} interet(s) commun(s)`);
  if (sharedIntent > 0) reasons.push("recherche compatible");
  if (activityFit > 0) reasons.push("sorties compatibles");
  if (relationship && relationship.score >= 40) reasons.push("lien deja actif");
  if (romanceFit > 0) reasons.push("potentiel romantique");
  if (resident.reputation >= 70) reasons.push("profil influent");
  if (reasons.length === 0) reasons.push("profil a decouvrir");

  return {
    resident,
    score,
    tier: tierFor(score),
    reasons: reasons.slice(0, 4),
    intent: intentFor(avatar, resident)
  };
}

export function getBestProfileMatches(
  avatar: AvatarProfile | null,
  residents: ResidentSeed[],
  relationships: RelationshipRecord[]
) {
  return residents
    .map((resident) => computeResidentMatch(
      avatar,
      resident,
      relationships.find((relationship) => relationship.residentId === resident.id)
    ))
    .sort((a, b) => b.score - a.score);
}
