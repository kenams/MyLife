import type { LifeActionId } from "@/lib/types";

export type MissionCategory = "daily" | "weekly" | "story";
export type MissionStatus = "locked" | "active" | "completed" | "claimed";

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  emoji: string;
  xpReward: number;
  moneyReward: number;
  requirements: MissionRequirement[];
  unlockLevel?: number;
}

export interface MissionRequirement {
  action: LifeActionId;
  count: number;
  current: number;
}

export interface MissionProgress {
  missionId: string;
  status: MissionStatus;
  requirements: MissionRequirement[];
  startedAt: string;
  completedAt?: string;
  claimedAt?: string;
}

export const MISSIONS: Mission[] = [
  // ── Daily ──
  {
    id: "daily-eat-3",
    title: "Bien se nourrir",
    description: "Mange 3 repas sains aujourd'hui",
    category: "daily",
    emoji: "🍽️",
    xpReward: 60,
    moneyReward: 10,
    requirements: [{ action: "healthy-meal", count: 3, current: 0 }],
  },
  {
    id: "daily-hydrate-5",
    title: "Bien s'hydrater",
    description: "Bois 5 fois dans la journée",
    category: "daily",
    emoji: "💧",
    xpReward: 40,
    moneyReward: 5,
    requirements: [{ action: "hydrate", count: 5, current: 0 }],
  },
  {
    id: "daily-exercise",
    title: "Bouger le corps",
    description: "Fais une activité physique",
    category: "daily",
    emoji: "🏃",
    xpReward: 50,
    moneyReward: 8,
    requirements: [{ action: "walk", count: 1, current: 0 }],
  },
  {
    id: "daily-meditate",
    title: "Moment de calme",
    description: "Médite au moins une fois",
    category: "daily",
    emoji: "🧘",
    xpReward: 35,
    moneyReward: 0,
    requirements: [{ action: "meditate", count: 1, current: 0 }],
  },
  {
    id: "daily-social",
    title: "Connexion sociale",
    description: "Prends un café avec quelqu'un",
    category: "daily",
    emoji: "☕",
    xpReward: 45,
    moneyReward: 0,
    requirements: [{ action: "cafe-chat", count: 1, current: 0 }],
  },
  // ── Weekly ──
  {
    id: "weekly-work-5",
    title: "Semaine productive",
    description: "Travaille 5 fois cette semaine",
    category: "weekly",
    emoji: "💼",
    xpReward: 200,
    moneyReward: 50,
    requirements: [{ action: "work-shift", count: 5, current: 0 }],
    unlockLevel: 2,
  },
  {
    id: "weekly-sport-3",
    title: "Triple cardio",
    description: "Fais 3 séances sportives",
    category: "weekly",
    emoji: "🏀",
    xpReward: 180,
    moneyReward: 30,
    requirements: [
      { action: "team-sport", count: 2, current: 0 },
      { action: "walk", count: 1, current: 0 },
    ],
    unlockLevel: 3,
  },
  {
    id: "weekly-read-5",
    title: "Le savoir c'est le pouvoir",
    description: "Lis 5 fois dans la semaine",
    category: "weekly",
    emoji: "📚",
    xpReward: 160,
    moneyReward: 20,
    requirements: [{ action: "read-book", count: 5, current: 0 }],
    unlockLevel: 4,
  },
  // ── Story ──
  {
    id: "story-first-meal",
    title: "Premier repas maison",
    description: "Cuisine pour la première fois",
    category: "story",
    emoji: "🥘",
    xpReward: 100,
    moneyReward: 15,
    requirements: [{ action: "home-cooking", count: 1, current: 0 }],
  },
  {
    id: "story-first-sport",
    title: "Première victoire sportive",
    description: "Participe à ton premier sport collectif",
    category: "story",
    emoji: "🏆",
    xpReward: 150,
    moneyReward: 25,
    requirements: [{ action: "team-sport", count: 1, current: 0 }],
    unlockLevel: 2,
  },
  {
    id: "story-zen-master",
    title: "Maître du zen",
    description: "Médite 10 fois au total",
    category: "story",
    emoji: "☯️",
    xpReward: 250,
    moneyReward: 40,
    requirements: [{ action: "meditate", count: 10, current: 0 }],
    unlockLevel: 3,
  },
  {
    id: "story-social-butterfly",
    title: "Papillon social",
    description: "Prends 10 cafés avec des gens",
    category: "story",
    emoji: "🦋",
    xpReward: 300,
    moneyReward: 50,
    requirements: [{ action: "cafe-chat", count: 10, current: 0 }],
    unlockLevel: 5,
  },
];

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function getActiveMissions(progresses: MissionProgress[], playerLevel: number): Mission[] {
  return MISSIONS.filter((m) => {
    if ((m.unlockLevel ?? 1) > playerLevel) return false;
    const prog = progresses.find((p) => p.missionId === m.id);
    return !prog || prog.status === "active";
  }).slice(0, 6);
}

export function applyActionToMissions(
  progresses: MissionProgress[],
  action: LifeActionId,
  playerLevel: number
): { updatedProgresses: MissionProgress[]; justCompleted: string[] } {
  const now = new Date().toISOString();
  const justCompleted: string[] = [];

  const updatedProgresses = progresses.map((prog) => {
    if (prog.status !== "active") return prog;
    const mission = getMission(prog.missionId);
    if (!mission) return prog;

    const updatedReqs = prog.requirements.map((req) => {
      if (req.action === action) return { ...req, current: req.current + 1 };
      return req;
    });

    const isComplete = updatedReqs.every((r) => r.current >= r.count);
    if (isComplete && prog.status === "active") {
      justCompleted.push(prog.missionId);
      return { ...prog, requirements: updatedReqs, status: "completed" as MissionStatus, completedAt: now };
    }

    return { ...prog, requirements: updatedReqs };
  });

  // Auto-activate new missions if under 6 active
  const activeMissions = MISSIONS.filter((m) => {
    if ((m.unlockLevel ?? 1) > playerLevel) return false;
    const prog = updatedProgresses.find((p) => p.missionId === m.id);
    return !prog;
  });

  const currentActive = updatedProgresses.filter((p) => p.status === "active").length;
  const toAdd = activeMissions.slice(0, Math.max(0, 6 - currentActive));

  const newProgresses = [
    ...updatedProgresses,
    ...toAdd.map((m): MissionProgress => ({
      missionId: m.id,
      status: "active",
      requirements: m.requirements.map((r) => ({ ...r, current: 0 })),
      startedAt: now,
    })),
  ];

  return { updatedProgresses: newProgresses, justCompleted };
}

export function claimMissionReward(
  progresses: MissionProgress[],
  missionId: string
): { updatedProgresses: MissionProgress[]; xp: number; money: number } {
  const mission = getMission(missionId);
  if (!mission) return { updatedProgresses: progresses, xp: 0, money: 0 };

  const updatedProgresses = progresses.map((p) =>
    p.missionId === missionId && p.status === "completed"
      ? { ...p, status: "claimed" as MissionStatus, claimedAt: new Date().toISOString() }
      : p
  );

  return { updatedProgresses, xp: mission.xpReward, money: mission.moneyReward };
}
