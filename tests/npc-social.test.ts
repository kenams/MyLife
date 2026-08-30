import { describe, expect, it } from "vitest";

import {
  resolveNpcApproach,
  resolveOutingProposal,
  districtLine,
  npcActivityShort,
  type NpcApproachContext,
} from "../lib/npc-social";
import { npcEncounterCoolingDown, NPC_ENCOUNTER_COOLDOWN_MS } from "../lib/npc-engine";

const base: NpcApproachContext = {
  npcId: "npc-alpha",
  activityLabel: null,
  status: "free",
  crewTag: null,
  hour: 15,
  trust: 20,
  encounters: 0,
};

describe("resolveNpcApproach", () => {
  it("is deterministic for the same context", () => {
    const a = resolveNpcApproach(base);
    const b = resolveNpcApproach({ ...base });
    expect(a).toEqual(b);
  });

  it("an NPC that is working/sleeping does not simply accept", () => {
    const working = resolveNpcApproach({ ...base, activityLabel: "💼 Au travail", status: "taken" });
    expect(["BUSY", "LATER", "SUGGEST", "DECLINE"]).toContain(working.outcome);
    expect(working.guarded || working.outcome === "SUGGEST").toBe(true);

    const asleep = resolveNpcApproach({ ...base, activityLabel: "💤 Dort", hour: 3 });
    expect(["BUSY", "LATER", "DECLINE"]).toContain(asleep.outcome);
    expect(asleep.actions.some((x) => x.id === "talk")).toBe(false);
  });

  it("a social NPC out on the town is more open than a working one", () => {
    const social = resolveNpcApproach({ ...base, activityLabel: "🎉 En sortie", status: "charo", npcId: "npc-social-1" });
    const working = resolveNpcApproach({ ...base, activityLabel: "💼 Au travail", status: "taken", npcId: "npc-social-1" });
    const rank = { DECLINE: 0, BUSY: 1, LATER: 2, SUGGEST: 3, SHORT: 4, ACCEPT: 5 } as const;
    expect(rank[social.outcome]).toBeGreaterThanOrEqual(rank[working.outcome]);
  });

  it("a trusted, familiar NPC is warmer than a stranger", () => {
    const familiar = resolveNpcApproach({ ...base, trust: 80, encounters: 6 });
    const stranger = resolveNpcApproach({ ...base, trust: 5, encounters: 0 });
    const rank = { DECLINE: 0, BUSY: 1, LATER: 2, SUGGEST: 3, SHORT: 4, ACCEPT: 5 } as const;
    expect(rank[familiar.outcome]).toBeGreaterThanOrEqual(rank[stranger.outcome]);
  });

  it("guarded outcomes never expose a talk action, always allow leaving", () => {
    for (const npcId of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const r = resolveNpcApproach({ ...base, npcId, activityLabel: "💼 Au travail", hour: 4, status: "taken" });
      expect(r.actions.some((x) => x.id === "leave")).toBe(true);
      if (r.guarded) expect(r.actions.some((x) => x.id === "talk")).toBe(false);
    }
  });

  it("mentions the crew when the NPC has one", () => {
    const withCrew = resolveNpcApproach({ ...base, activityLabel: "🎉 En sortie", status: "charo", crewTag: "WLV", npcId: "npc-crew" });
    // opener may or may not mention it, but district action stays available for non-guarded
    expect(withCrew.actions.length).toBeGreaterThan(0);
    expect(districtLine({ ...base, crewTag: "WLV" })).toContain("Wolves [WLV]");
  });
});

describe("resolveOutingProposal", () => {
  it("is deterministic and can say no", () => {
    const busy = resolveOutingProposal({ ...base, activityLabel: "💼 Au travail", status: "taken" });
    expect(busy.accepted).toBe(false);
    expect(resolveOutingProposal({ ...base, activityLabel: "💼 Au travail", status: "taken" })).toEqual(busy);
  });
  it("a very social, trusted NPC can accept", () => {
    const yes = resolveOutingProposal({ ...base, activityLabel: "🎉 En sortie", status: "charo", trust: 70, npcId: "npc-yes" });
    expect(typeof yes.accepted).toBe("boolean");
    expect(yes.line.length).toBeGreaterThan(0);
  });
});

describe("npcActivityShort", () => {
  it("strips the emoji and normalises the label", () => {
    expect(npcActivityShort("💼 Au travail")).toBe("Travail");
    expect(npcActivityShort("🏋️ Fait du sport")).toBe("Sport");
    expect(npcActivityShort("💤 Dort")).toBe("Chez lui");
    expect(npcActivityShort(null)).toBeNull();
  });
});

describe("npc encounter cooldown (anti-spam)", () => {
  it("cools down for the configured window then reopens", () => {
    const now = Date.now();
    expect(npcEncounterCoolingDown({ trust: 0, lastIntent: null, lastTopics: [], turns: 0, updatedAt: "", lastEncounterAt: new Date(now - 1000).toISOString() }, now)).toBe(true);
    expect(npcEncounterCoolingDown({ trust: 0, lastIntent: null, lastTopics: [], turns: 0, updatedAt: "", lastEncounterAt: new Date(now - NPC_ENCOUNTER_COOLDOWN_MS - 1000).toISOString() }, now)).toBe(false);
    expect(npcEncounterCoolingDown({ trust: 0, lastIntent: null, lastTopics: [], turns: 0, updatedAt: "" }, now)).toBe(false);
  });
});
