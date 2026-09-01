import { describe, expect, it } from "vitest";

import {
  NPC_SOCIAL_FIRST_DELAY_MS,
  NPC_SOCIAL_REFUSAL_COOLDOWN_MS,
  NPC_SOCIAL_RETURN_DELAY_MS,
} from "@/lib/npc-social";

describe("NPC Social beta contract", () => {
  it("guarantees the first directed surface inside the 3 minute gate", () => {
    expect(NPC_SOCIAL_FIRST_DELAY_MS).toBeGreaterThan(0);
    expect(NPC_SOCIAL_FIRST_DELAY_MS).toBeLessThan(180_000);
  });

  it("surfaces a known-NPC callback inside the 3 minute gate", () => {
    expect(NPC_SOCIAL_RETURN_DELAY_MS).toBeGreaterThan(0);
    expect(NPC_SOCIAL_RETURN_DELAY_MS).toBeLessThan(180_000);
  });

  it("keeps refusal cooldown long enough to avoid immediate spam", () => {
    expect(NPC_SOCIAL_REFUSAL_COOLDOWN_MS).toBeGreaterThanOrEqual(60 * 60_000);
  });
});
