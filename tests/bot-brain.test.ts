import { describe, expect, it } from "vitest";

import { buildDirectBotReply, buildRoomBotReplies, detectBotIntent } from "@/lib/bot-brain";
import type { NpcState } from "@/lib/types";

function npc(id: string, name = id): NpcState {
  return {
    id,
    name,
    locationSlug: "cafe",
    action: "chatting",
    mood: 78,
    energy: 74,
    hunger: 65,
    stress: 20,
    hygiene: 80,
    money: 120,
    xp: 30,
    level: 2,
    reputation: 50,
    streak: 2,
    lastTickAt: "2026-04-18T12:00:00.000Z",
    lastMessageAt: null,
    lastInviteAt: null,
    posX: 40,
    posY: 50,
    presenceOnline: true,
    lastOnlineAt: null
  };
}

describe("bot-brain", () => {
  it("detects high level user intent", () => {
    expect(detectBotIntent("bonjour tu me reconnais ?")).toBe("greeting");
    expect(detectBotIntent("viens dans ma room")).toBe("invite");
    expect(detectBotIntent("je suis fatigue et stresse")).toBe("wellbeing");
    expect(detectBotIntent("on va au cafe ?")).toBe("activity");
  });

  it("recognizes the player name in direct replies", () => {
    const reply = buildDirectBotReply({
      npc: npc("ava", "Ava"),
      residentId: "ava",
      residentName: "Ava",
      playerName: "Kenan",
      playerMessage: "tu me reconnais ?",
      relationshipScore: 65,
      messageCount: 1
    });

    expect(reply).toContain("Kenan");
    expect(reply.toLowerCase()).toContain("reconnais");
  });

  it("generates room bot replies for live groups", () => {
    const replies = buildRoomBotReplies({
      roomId: "room-live",
      roomName: "Cafe Social",
      playerName: "Kenan",
      playerMessage: "salut la room, qui est dispo pour une activite ?",
      onlineNpcs: [npc("ava", "Ava"), npc("yan", "Yan")],
      maxReplies: 2
    });

    expect(replies).toHaveLength(2);
    expect(replies[0].authorName).toBe("Ava");
    expect(replies[0].kind).toBe("message");
  });
});
