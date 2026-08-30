import type { NpcState } from "@/lib/types";

export type NpcIntent = "REST" | "WORK" | "EAT" | "SOCIAL" | "CREW" | "DATE" | "SPORT" | "ROAM" | "IDLE";

export type NpcContext = {
  hour: number;
  districtActivity: number;
  nearbyPeople: number;
  hasCrewOpportunity: boolean;
  hasDatingOpportunity: boolean;
  hasSocialOpportunity: boolean;
};

export type NpcIntentScore = {
  intent: NpcIntent;
  score: number;
  reason: string;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function hasTrait(npc: NpcState, trait: string): boolean {
  return String(npc.personality ?? "").toLowerCase().includes(trait.toLowerCase());
}

export function rankNpcIntents(npc: NpcState, context: NpcContext): NpcIntentScore[] {
  const energy = clamp(Number(npc.energy ?? 50));
  const hunger = clamp(Number(npc.hunger ?? 30));
  const stress = clamp(Number(npc.stress ?? 25));
  const sociability = clamp(Number(npc.sociability ?? 50));
  const hour = Math.max(0, Math.min(23, Math.floor(context.hour)));
  const scores: NpcIntentScore[] = [];

  scores.push({ intent: "IDLE", score: 30 + (100 - energy) * 0.08, reason: "aucun besoin prioritaire" });
  scores.push({ intent: "ROAM", score: 28 + clamp(context.districtActivity) * 0.2, reason: "exploration naturelle du quartier" });

  if (energy < 28 || hour < 6) scores.push({ intent: "REST", score: 90 + (28 - Math.min(28, energy)), reason: "fatigue ou rythme nocturne" });
  if (hunger > 60) scores.push({ intent: "EAT", score: 65 + hunger * 0.35, reason: "faim" });
  if (hour >= 8 && hour < 18 && hasTrait(npc, "travailleur")) scores.push({ intent: "WORK", score: 68 + energy * 0.15 - stress * 0.1, reason: "routine professionnelle" });
  if (hasTrait(npc, "sportif") && energy > 40 && (hour < 10 || hour >= 17)) scores.push({ intent: "SPORT", score: 58 + energy * 0.2, reason: "routine sportive" });

  if (context.hasSocialOpportunity && context.nearbyPeople > 0) {
    const traitBoost = hasTrait(npc, "social") || hasTrait(npc, "organisateur") ? 18 : 0;
    scores.push({ intent: "SOCIAL", score: 42 + sociability * 0.45 + traitBoost, reason: "opportunite sociale et personnalite" });
  }

  if (context.hasCrewOpportunity && npc.crewId) {
    const traitBoost = hasTrait(npc, "leader") || hasTrait(npc, "competitif") ? 18 : 8;
    scores.push({ intent: "CREW", score: 54 + traitBoost + clamp(context.districtActivity) * 0.12, reason: "opportunite de crew" });
  }

  if (context.hasDatingOpportunity && sociability >= 45 && energy >= 35) {
    scores.push({ intent: "DATE", score: 38 + sociability * 0.3 + (hasTrait(npc, "romantique") ? 22 : 0), reason: "opportunite de rencontre" });
  }

  return scores.sort((a, b) => b.score - a.score || a.intent.localeCompare(b.intent));
}

export function chooseNpcIntent(npc: NpcState, context: NpcContext): NpcIntentScore {
  return rankNpcIntents(npc, context)[0];
}

export function canNpcInitiate(npc: NpcState, now: Date, cooldownMinutes = 120): boolean {
  if (!npc.presenceOnline) return false;
  const last = npc.lastInviteAt ?? npc.lastMessageAt;
  if (!last) return true;
  const elapsed = now.getTime() - Date.parse(last);
  return Number.isFinite(elapsed) && elapsed >= cooldownMinutes * 60_000;
}
