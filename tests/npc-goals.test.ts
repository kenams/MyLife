import { describe, expect, it } from "vitest";

import { getNpcMultiDayGoal } from "@/lib/npc-goals";

describe("npc multi-day goals", () => {
  it("is stable for the same npc inside the same three-day window", () => {
    const a = getNpcMultiDayGoal("npc-42", "social organisateur", new Date("2026-08-31T08:00:00Z"));
    const b = getNpcMultiDayGoal("npc-42", "social organisateur", new Date("2026-08-31T20:00:00Z"));

    expect(a.type).toBe(b.type);
    expect(a.label).toBe(b.label);
    expect(a.startedAt).toBe(b.startedAt);
    expect(a.endsAt).toBe(b.endsAt);
  });

  it("keeps a bounded three-day horizon and progress", () => {
    const now = new Date("2026-08-31T12:00:00Z");
    const goal = getNpcMultiDayGoal("npc-sport", "sportif", now);
    const duration = Date.parse(goal.endsAt) - Date.parse(goal.startedAt);

    expect(duration).toBe(3 * 24 * 60 * 60 * 1000);
    expect(goal.progress).toBeGreaterThanOrEqual(0);
    expect(goal.progress).toBeLessThanOrEqual(1);
  });

  it("uses personality to bias the available goal family", () => {
    const goal = getNpcMultiDayGoal("npc-sportif", "sportif", new Date("2026-08-31T12:00:00Z"));
    expect(["SPORT", "SOCIAL", "EXPLORATION", "WORK"]).toContain(goal.type);
  });
});
