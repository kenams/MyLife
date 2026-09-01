import { describe, expect, it } from "vitest";

import { selectNpcSocialPrompt } from "@/lib/npc-social";
import type { NpcRelation, NpcState } from "@/lib/types";

function npc(id: string, district: string, sociability = 60): NpcState {
  return {
    id,
    name: `${id}.Test`,
    is_npc: true,
    locationSlug: "cafe",
    action: "idle",
    mood: 70,
    energy: 70,
    hunger: 70,
    stress: 20,
    hygiene: 80,
    money: 100,
    xp: 0,
    level: 1,
    reputation: 30,
    streak: 1,
    lastTickAt: new Date(0).toISOString(),
    lastMessageAt: null,
    lastInviteAt: null,
    posX: 50,
    posY: 50,
    presenceOnline: true,
    lastOnlineAt: new Date(0).toISOString(),
    homeDistrictSlug: district,
    currentDistrictSlug: district,
    sociability,
  };
}

function relation(npcId: string, score = 15, totalInteractions = 1): NpcRelation {
  return {
    npcId,
    score,
    level: score >= 15 ? "contact" : "inconnu",
    lastInteractionAt: new Date(0).toISOString(),
    totalInteractions,
  };
}

describe("NPC Social V1", () => {
  it("selects a social resident in the player's district for a newcomer", () => {
    const prompt = selectNpcSocialPrompt({
      npcs: [npc("far", "Minimes", 90), npc("near", "Capitole", 55)],
      relations: [],
      playerDistrict: "Capitole",
    });

    expect(prompt?.npcId).toBe("near");
    expect(prompt?.kind).toBe("welcome-newcomer");
  });

  it("prioritizes a known persistent relation on return", () => {
    const prompt = selectNpcSocialPrompt({
      npcs: [npc("new", "Capitole", 99), npc("known", "Saint-Cyprien", 40)],
      relations: [relation("known", 35, 3)],
      playerDistrict: "Capitole",
    });

    expect(prompt?.npcId).toBe("known");
    expect(prompt?.kind).toBe("reconnect-follow-up");
    expect(prompt?.body).toContain("se souvient");
  });

  it("does not immediately retry a refused resident", () => {
    const prompt = selectNpcSocialPrompt({
      npcs: [npc("refused", "Capitole", 99), npc("other", "Capitole", 50)],
      relations: [],
      playerDistrict: "Capitole",
      refusedNpcIds: ["refused"],
    });

    expect(prompt?.npcId).toBe("other");
  });

  it("excludes QA residents from player-facing encounters", () => {
    const qa = { ...npc("qa", "Capitole", 100), is_qa: true };
    const prompt = selectNpcSocialPrompt({
      npcs: [qa, npc("real-sim", "Capitole", 40)],
      relations: [],
      playerDistrict: "Capitole",
    });

    expect(prompt?.npcId).toBe("real-sim");
  });
});
