import { generateDailyQuests } from "@/lib/daily-quests";
import { seededDailyGoals } from "@/lib/game-engine";
import { createInitialMissionProgresses } from "@/lib/missions";
import type { AvatarStats } from "@/lib/types";
import type { DailyQuest } from "@/lib/daily-quests";
import type { MissionProgress } from "@/lib/missions";
import type { DailyGoal } from "@/lib/types";

export function shouldResetDailyGoals(lastResetAt: string | null | undefined, today = new Date().toDateString()): boolean {
  if (!lastResetAt) return true;
  return new Date(lastResetAt).toDateString() !== today;
}

export function createFreshPlayerProgressState(stats: AvatarStats, createdAt = new Date().toISOString()) {
  const today = new Date(createdAt).toDateString();
  return {
    dailyGoals: seededDailyGoals(),
    lastDailyGoalResetAt: today,
    dailyQuests: generateDailyQuests(stats, today),
    questLastRefreshDate: today,
    missionProgresses: createInitialMissionProgresses(1, createdAt),
    playerXp: 0,
    playerLevel: 1,
    unlockedTalents: [] as string[],
    lastGain: null,
  };
}

export function playerProgressPersistenceSlice(state: {
  dailyGoals: DailyGoal[];
  lastDailyGoalResetAt: string | null;
  dailyQuests: DailyQuest[];
  questLastRefreshDate: string | null;
  missionProgresses: MissionProgress[];
  playerXp: number;
  playerLevel: number;
  unlockedTalents: string[];
}) {
  return {
    dailyGoals: state.dailyGoals,
    lastDailyGoalResetAt: state.lastDailyGoalResetAt,
    dailyQuests: state.dailyQuests,
    questLastRefreshDate: state.questLastRefreshDate,
    missionProgresses: state.missionProgresses,
    playerXp: state.playerXp,
    playerLevel: state.playerLevel,
    unlockedTalents: state.unlockedTalents,
  };
}
