import { describe, expect, it } from "vitest";

import { chooseNpcAction, rankNpcIntents } from "@/lib/npc-brain-policy";
import { seedLivingCityNpcs } from "@/lib/living-city";

describe("npc brain policy", () => {
  it("is deterministic for the same NPC and context", () => {
    const npc = {
      ...seedLivingCityNpcs("LOW", new Date("2026-08-29T12:00:00Z"))[0],
      personality: "social/organisateur",
      sociability: 80,
      presenceOnline: true,
    };
    const context = {
      hour: 20,
      districtActivity: 80,
      nearbyPeople: 4,
      hasCrewOpportunity: false,
      hasDatingOpportunity: false,
      hasSocialOpportunity: true,
    };

    expect(rankNpcIntents(npc, context)).toEqual(rankNpcIntents(npc, context));
  });

  it("returns DO_NOTHING when a social action is still on cooldown", () => {
    const now = new Date("2026-08-29T20:00:00Z");
    const npc = {
      ...seedLivingCityNpcs("LOW", now)[0],
      personality: "social/organisateur",
      sociability: 95,
      energy: 85,
      lastMessageAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
      presenceOnline: true,
    };

    const action = chooseNpcAction(npc, {
      hour: 20,
      districtActivity: 90,
      nearbyPeople: 5,
      hasCrewOpportunity: false,
      hasDatingOpportunity: true,
      hasSocialOpportunity: true,
    }, now);

    expect(action.intent).toBe("DO_NOTHING");
  });
});
