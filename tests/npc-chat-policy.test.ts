import { describe, expect, it } from "vitest";

import { shouldEnhanceNpcTurn } from "@/lib/npc-chat-policy";

describe("npc chat generative policy", () => {
  it("keeps routine and defensive exchanges local", () => {
    expect(shouldEnhanceNpcTurn("greeting", 0, "Salut")).toBe(false);
    expect(shouldEnhanceNpcTurn("farewell", 8, "À plus")).toBe(false);
    expect(shouldEnhanceNpcTurn("refusal", 8, "Non merci")).toBe(false);
    expect(shouldEnhanceNpcTurn("provocation", 8, "T'es relou")).toBe(false);
  });

  it("allows generative wording for moments that can matter", () => {
    expect(shouldEnhanceNpcTurn("propose_activity", 1, "On se voit ce soir ?")).toBe(true);
    expect(shouldEnhanceNpcTurn("ask_advice", 2, "Tu ferais quoi à ma place ?")).toBe(true);
    expect(shouldEnhanceNpcTurn("discuss_event", 2, "Tu vas à l'event ?")).toBe(true);
    expect(shouldEnhanceNpcTurn("flirt", 2, "Je te trouve cool")).toBe(true);
  });

  it("only enriches unknown messages after a real conversation", () => {
    const message = "Je sais pas trop quoi faire ces prochains jours, tu me conseilles quoi ?";
    expect(shouldEnhanceNpcTurn("unknown", 1, message)).toBe(false);
    expect(shouldEnhanceNpcTurn("unknown", 5, message)).toBe(true);
    expect(shouldEnhanceNpcTurn("unknown", 5, "ok ça marche")).toBe(false);
  });
});
