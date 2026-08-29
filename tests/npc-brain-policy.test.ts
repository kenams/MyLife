import { describe, expect, it } from "vitest";

import { canNpcInitiate, chooseNpcIntent } from "@/lib/npc-brain-policy";
import { seedLivingCityNpcs } from "@/lib/living-city";

describe("npc brain policy", () => {
  it("lets critical fatigue beat social opportunities", () => {
    const npc = { ...seedLivingCityNpcs("LOW", new Date("2026-08-29T20:00:00Z"))[0], energy: 8, presenceOnline: true };
    const choice = chooseNpcIntent(npc, {
      hour: 2,
      districtActivity: 90,
      nearbyPeople: 12,
      hasCrewOpportunity: true,
      hasDatingOpportunity: true,
      hasSocialOpportunity: true,
    });
    expect(choice.intent).toBe("REST");
  });

  it("uses personality and context instead of giving every NPC the same action", () => {
    const base = seedLivingCityNpcs("LOW", new Date("2026-08-29T19:00:00Z"))[0];
    const social = { ...base, personality: "social/organisateur", sociability: 90, energy: 80 };
    const quiet = { ...base, personality: "discret/travailleur", sociability: 25, energy: 80 };
    const context = {
      hour: 20,
      districtActivity: 85,
      nearbyPeople: 8,
      hasCrewOpportunity: false,
      hasDatingOpportunity: false,
      hasSocialOpportunity: true,
    };
    expect(chooseNpcIntent(social, context).intent).toBe("SOCIAL");
    expect(chooseNpcIntent(quiet, context).score).toBeLessThan(chooseNpcIntent(social, context).score);
  });

  it("enforces a contact cooldown to prevent NPC spam", () => {
    const now = new Date("2026-08-29T20:00:00Z");
    const npc = {
      ...seedLivingCityNpcs("LOW", now)[0],
      presenceOnline: true,
      lastMessageAt: "2026-08-29T19:30:00Z",
    };
    expect(canNpcInitiate(npc, now, 120)).toBe(false);
    expect(canNpcInitiate({ ...npc, lastMessageAt: "2026-08-29T17:00:00Z" }, now, 120)).toBe(true);
  });
});
