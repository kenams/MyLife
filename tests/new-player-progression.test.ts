import { describe, expect, it } from "vitest";

import {
  createFreshPlayerProgressState,
  playerProgressPersistenceSlice,
  shouldResetDailyGoals,
} from "../lib/fresh-player";
import { createStatsFromAvatar } from "../lib/game-engine";
import { claimMissionReward, createInitialMissionProgresses, getActiveMissions } from "../lib/missions";
import {
  getNewPlayerMapStep,
  isMapOpportunityAvailableAtLevel,
  playableMapOpportunities,
} from "../lib/new-player-loop";
import { getPlayerLevelFromXp } from "../lib/progression";

describe("new player progression", () => {
  it("starts daily progress at zero instead of inheriting 5/5", () => {
    const fresh = createFreshPlayerProgressState(createStatsFromAvatar(), "2026-08-30T10:00:00.000Z");

    expect(fresh.dailyGoals).toHaveLength(5);
    expect(fresh.dailyGoals.filter((goal) => goal.completed)).toHaveLength(0);
    expect(fresh.playerXp).toBe(0);
    expect(fresh.playerLevel).toBe(1);
  });

  it("resets daily goals only after the local day changes", () => {
    expect(shouldResetDailyGoals("Sun Aug 30 2026", "Sun Aug 30 2026")).toBe(false);
    expect(shouldResetDailyGoals("Sat Aug 29 2026", "Sun Aug 30 2026")).toBe(true);
    expect(shouldResetDailyGoals(null, "Sun Aug 30 2026")).toBe(true);
  });

  it("always exposes a playable level-one exploration before locked features", () => {
    const progresses = createInitialMissionProgresses(1, "2026-08-30T10:00:00.000Z");
    const lockedCrew = {
      id: "crew-alert", kind: "CREW" as const, title: "Crew", body: "Crew",
      priority: 90, source: "GAME" as const,
    };
    const opportunities = playableMapOpportunities([lockedCrew], 1, progresses);

    expect(getNewPlayerMapStep(1, progresses)?.intent).toBe("explore");
    expect(opportunities[0]?.id).toBe("new-player:explore");
    expect(isMapOpportunityAvailableAtLevel(lockedCrew, 1)).toBe(false);
    expect(isMapOpportunityAvailableAtLevel(lockedCrew, 2)).toBe(true);
  });

  it("pays a completed mission once", () => {
    const progresses = createInitialMissionProgresses(1).map((progress) =>
      progress.missionId === "daily-exercise" ? { ...progress, status: "completed" as const } : progress
    );
    const first = claimMissionReward(progresses, "daily-exercise");
    const second = claimMissionReward(first.updatedProgresses, "daily-exercise");

    expect(first.xp).toBe(50);
    expect(first.money).toBe(8);
    expect(second.xp).toBe(0);
    expect(second.money).toBe(0);
    expect(getActiveMissions(progresses, 1).some((mission) => mission.id === "daily-exercise")).toBe(true);
  });

  it("persists XP and levels up exactly once across the level-one loop", () => {
    const fresh = createFreshPlayerProgressState(createStatsFromAvatar());
    const xpGains = [20, 50, 10, 100, 12, 35];
    let xp = 0;
    let previousLevel = 1;
    let levelUps = 0;
    for (const gain of xpGains) {
      xp += gain;
      const level = getPlayerLevelFromXp(xp);
      if (level > previousLevel) levelUps += 1;
      previousLevel = level;
    }

    const persisted = playerProgressPersistenceSlice({ ...fresh, playerXp: xp, playerLevel: previousLevel });
    const reloaded = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    expect(xp).toBe(227);
    expect(reloaded.playerXp).toBe(227);
    expect(reloaded.playerLevel).toBe(2);
    expect(levelUps).toBe(1);
  });
});
