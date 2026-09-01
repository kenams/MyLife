import type { NpcRelation, NpcState } from "@/lib/types";

export const NPC_SOCIAL_FIRST_DELAY_MS = 45_000;
export const NPC_SOCIAL_RETURN_DELAY_MS = 60_000;
export const NPC_SOCIAL_REFUSAL_COOLDOWN_MS = 3 * 60 * 60_000;

export type NpcSocialPrompt = {
  npcId: string;
  npcName: string;
  district: string;
  kind: "welcome-newcomer" | "reconnect-follow-up";
  title: string;
  body: string;
};

type SelectionInput = {
  npcs: NpcState[];
  relations: NpcRelation[];
  playerDistrict: string;
  refusedNpcIds?: string[];
};

function displayName(name: string): string {
  return name.split(".")[0] || name;
}

function eligibleNpc(npc: NpcState, refused: Set<string>): boolean {
  return npc.is_qa !== true && !refused.has(npc.id) && npc.action !== "sleeping";
}

/**
 * Selects one existing Living City resident for a directed social moment.
 * This is presentation policy only: it does not tick NPCs or create a second engine.
 */
export function selectNpcSocialPrompt({
  npcs,
  relations,
  playerDistrict,
  refusedNpcIds = [],
}: SelectionInput): NpcSocialPrompt | null {
  const refused = new Set(refusedNpcIds);
  const relationByNpc = new Map(relations.map((relation) => [relation.npcId, relation]));

  // On return, preserve continuity: a resident the player already knows wins.
  const known = [...relations]
    .filter((relation) => relation.score >= 15 && !refused.has(relation.npcId))
    .sort((a, b) => b.score - a.score || b.totalInteractions - a.totalInteractions)
    .map((relation) => npcs.find((npc) => npc.id === relation.npcId))
    .find((npc): npc is NpcState => Boolean(npc && eligibleNpc(npc, refused)));

  if (known) {
    const name = displayName(known.name);
    const relation = relationByNpc.get(known.id)!;
    return {
      npcId: known.id,
      npcName: name,
      district: known.currentDistrictSlug ?? known.homeDistrictSlug ?? playerDistrict,
      kind: "reconnect-follow-up",
      title: `${name} revient vers toi`,
      body: relation.totalInteractions > 1
        ? `${name} se souvient de vos échanges et vient reprendre la discussion.`
        : `${name} se souvient de votre première rencontre et vient prendre de tes nouvelles.`,
    };
  }

  const candidates = npcs
    .filter((npc) => eligibleNpc(npc, refused))
    .sort((a, b) => {
      const aHere = (a.currentDistrictSlug ?? a.homeDistrictSlug) === playerDistrict ? 1 : 0;
      const bHere = (b.currentDistrictSlug ?? b.homeDistrictSlug) === playerDistrict ? 1 : 0;
      if (aHere !== bHere) return bHere - aHere;
      const social = (b.sociability ?? 50) - (a.sociability ?? 50);
      if (social !== 0) return social;
      return a.id.localeCompare(b.id);
    });

  const npc = candidates[0];
  if (!npc) return null;
  const name = displayName(npc.name);
  const district = npc.currentDistrictSlug ?? npc.homeDistrictSlug ?? playerDistrict;
  return {
    npcId: npc.id,
    npcName: name,
    district,
    kind: "welcome-newcomer",
    title: `${name} te remarque`,
    body: `${name} est dans le coin à ${district} et vient te parler. Tu réponds ?`,
  };
}
