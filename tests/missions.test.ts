import { describe, expect, it } from "vitest";

import { claimMissionReward, type MissionProgress } from "@/lib/missions";

function progress(status: MissionProgress["status"]): MissionProgress {
  return {
    missionId: "daily-exercise",
    status,
    requirements: [{ action: "walk", count: 1, current: status === "active" ? 0 : 1 }],
    startedAt: "2026-08-30T10:00:00.000Z",
  };
}

describe("mission reward idempotence", () => {
  it("rewards a completed mission once", () => {
    const first = claimMissionReward([progress("completed")], "daily-exercise");
    expect(first.xp).toBe(50);
    expect(first.money).toBe(8);
    expect(first.updatedProgresses[0].status).toBe("claimed");

    const second = claimMissionReward(first.updatedProgresses, "daily-exercise");
    expect(second.xp).toBe(0);
    expect(second.money).toBe(0);
    expect(second.updatedProgresses).toBe(first.updatedProgresses);
  });

  it("does not reward active, locked, or unknown missions", () => {
    expect(claimMissionReward([progress("active")], "daily-exercise").xp).toBe(0);
    expect(claimMissionReward([progress("locked")], "daily-exercise").money).toBe(0);
    expect(claimMissionReward([progress("completed")], "missing").xp).toBe(0);
  });
});
