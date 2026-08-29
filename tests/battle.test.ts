import { describe, expect, it } from "vitest";

import { nextBattleSlot } from "@/lib/battle-schedule";
import { pickQuiz, TOULOUSE_QUIZ } from "@/lib/battle-quiz";
import { liveScore } from "@/lib/battle-score";

describe("nextBattleSlot", () => {
  it("tombe toujours un mercredi ou un samedi à 20h", () => {
    for (let i = 0; i < 14; i++) {
      const d = nextBattleSlot(new Date(2026, 8, 1 + i, 10, 0));
      expect([3, 6]).toContain(d.getDay());
      expect(d.getHours()).toBe(20);
    }
  });

  it("est strictement dans le futur", () => {
    const now = new Date(2026, 8, 2, 19, 0); // mercredi 19h
    const slot = nextBattleSlot(now);
    expect(slot.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("pickQuiz", () => {
  it("est déterministe pour une graine donnée", () => {
    const a = pickQuiz("battle-abc", 3).map((q) => q.q);
    const b = pickQuiz("battle-abc", 3).map((q) => q.q);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });

  it("varie selon la graine", () => {
    const a = pickQuiz("seed-1", 3).map((q) => q.q).join();
    const b = pickQuiz("seed-2", 3).map((q) => q.q).join();
    expect(a).not.toBe(b);
  });

  it("toutes les questions ont une réponse valide", () => {
    for (const q of TOULOUSE_QUIZ) {
      expect(q.choices[q.answer]).toBeDefined();
    }
  });
});

describe("liveScore", () => {
  it("donne l'avantage au camp qui performe, pas seulement au plus nombreux", () => {
    const few = [{ user_id: "a", crew_id: "A", r1_taps: 60, r2_score: 3, r3_hits: 8 }];
    const many = [
      { user_id: "b", crew_id: "B", r1_taps: 5, r2_score: 0, r3_hits: 0 },
      { user_id: "c", crew_id: "B", r1_taps: 5, r2_score: 0, r3_hits: 0 },
      { user_id: "d", crew_id: "B", r1_taps: 5, r2_score: 0, r3_hits: 0 },
    ];
    const s = liveScore([...few, ...many], "A", "B");
    expect(s.attackerPct).toBeGreaterThan(s.defenderPct);
  });

  it("somme à 100", () => {
    const s = liveScore(
      [
        { user_id: "a", crew_id: "A", r1_taps: 30, r2_score: 1, r3_hits: 4 },
        { user_id: "b", crew_id: "B", r1_taps: 20, r2_score: 2, r3_hits: 3 },
      ],
      "A",
      "B"
    );
    expect(s.attackerPct + s.defenderPct).toBeCloseTo(100, 5);
  });
});
