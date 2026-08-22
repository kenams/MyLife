/**
 * Daily Quests — 3 quêtes générées chaque jour selon l'état du joueur.
 * Refresh à minuit. Récompenses : XP + crédits + bonus relation.
 */

import type { AvatarStats } from "@/lib/types";

export type QuestCategory = "survie" | "social" | "explore" | "progression";

export type DailyQuest = {
  id: string;
  category: QuestCategory;
  emoji: string;
  title: string;
  description: string;
  actionId: string;       // lié à une LifeActionId ou une action custom
  xpReward: number;
  moneyReward: number;
  completed: boolean;
  claimed: boolean;
  createdAt: string;
};

type QuestTemplate = Omit<DailyQuest, "id" | "completed" | "claimed" | "createdAt">;

const QUEST_POOL: QuestTemplate[] = [
  // ── Survie ──────────────────────────────────────────────────────────────────
  {
    category: "survie",
    emoji: "🍱",
    title: "Repas du jour",
    description: "Mange quelque chose pour recharger tes forces.",
    actionId: "healthy-meal",
    xpReward: 25,
    moneyReward: 5,
  },
  {
    category: "survie",
    emoji: "🛌",
    title: "Repos nocturne",
    description: "Dors pour récupérer ton énergie maximale.",
    actionId: "sleep",
    xpReward: 20,
    moneyReward: 0,
  },
  {
    category: "survie",
    emoji: "🚿",
    title: "Routine hygiène",
    description: "Prends une douche et maintiens ton image.",
    actionId: "shower",
    xpReward: 15,
    moneyReward: 0,
  },
  {
    category: "survie",
    emoji: "🏃",
    title: "Marche matinale",
    description: "Fais une marche pour clarifier les idées.",
    actionId: "walk",
    xpReward: 18,
    moneyReward: 3,
  },
  {
    category: "survie",
    emoji: "🧘",
    title: "Moment zen",
    description: "Médite 10 minutes pour réduire le stress.",
    actionId: "meditate",
    xpReward: 20,
    moneyReward: 0,
  },
  // ── Social ───────────────────────────────────────────────────────────────────
  {
    category: "social",
    emoji: "☕",
    title: "Café social",
    description: "Prends un café avec quelqu'un du quartier.",
    actionId: "cafe-chat",
    xpReward: 30,
    moneyReward: 10,
  },
  {
    category: "social",
    emoji: "🏀",
    title: "Sport collectif",
    description: "Joue avec d'autres pour renforcer le lien social.",
    actionId: "team-sport",
    xpReward: 35,
    moneyReward: 8,
  },
  {
    category: "social",
    emoji: "💬",
    title: "Conversation",
    description: "Parle à un résident du quartier.",
    actionId: "talk-npc",
    xpReward: 22,
    moneyReward: 5,
  },
  {
    category: "social",
    emoji: "🤝",
    title: "Invitation envoyée",
    description: "Propose une activité à un résident.",
    actionId: "send-invite",
    xpReward: 28,
    moneyReward: 5,
  },
  {
    category: "social",
    emoji: "🎭",
    title: "Soirée entre amis",
    description: "Participe à une sortie dans un lieu social.",
    actionId: "go-out",
    xpReward: 40,
    moneyReward: 15,
  },
  // ── Explore ──────────────────────────────────────────────────────────────────
  {
    category: "explore",
    emoji: "🗺️",
    title: "Nouveau quartier",
    description: "Visite un lieu que tu n'as pas fréquenté aujourd'hui.",
    actionId: "travel",
    xpReward: 20,
    moneyReward: 8,
  },
  {
    category: "explore",
    emoji: "📍",
    title: "Apparaître sur la map",
    description: "Active volontairement ta visibilité et apparais sur la Life Map de Toulouse.",
    actionId: "appear-on-map",
    xpReward: 30,
    moneyReward: 10,
  },
  {
    category: "explore",
    emoji: "👀",
    title: "Rencontre en live",
    description: "Croise un autre joueur à moins de 500m sur la map.",
    actionId: "map-encounter",
    xpReward: 45,
    moneyReward: 15,
  },
  {
    category: "explore",
    emoji: "🏙️",
    title: "3 quartiers en un jour",
    description: "Déplace-toi dans 3 quartiers différents de Toulouse.",
    actionId: "visit-3-districts",
    xpReward: 60,
    moneyReward: 20,
  },
  {
    category: "explore",
    emoji: "⚡",
    title: "Flash event",
    description: "Participe à un flash event sur la map.",
    actionId: "join-flash-event",
    xpReward: 50,
    moneyReward: 20,
  },
  {
    category: "explore",
    emoji: "🛡️",
    title: "Défendre la zone crew",
    description: "Reste dans la zone de ton crew pendant 5 minutes.",
    actionId: "defend-crew-zone",
    xpReward: 40,
    moneyReward: 12,
  },
  // ── Progression ───────────────────────────────────────────────────────────────
  {
    category: "progression",
    emoji: "💼",
    title: "Session de travail",
    description: "Complète un shift pour gagner des crédits.",
    actionId: "work-shift",
    xpReward: 30,
    moneyReward: 0,
  },
  {
    category: "progression",
    emoji: "🏋️",
    title: "Entraînement",
    description: "Va à la salle de sport pour améliorer ta forme.",
    actionId: "gym",
    xpReward: 28,
    moneyReward: 5,
  },
  {
    category: "progression",
    emoji: "📚",
    title: "Lecture",
    description: "Lis pour gagner en motivation et connaissance.",
    actionId: "read-book",
    xpReward: 22,
    moneyReward: 3,
  },
  {
    category: "progression",
    emoji: "🍳",
    title: "Cuisine maison",
    description: "Prépare un repas toi-même pour économiser.",
    actionId: "home-cooking",
    xpReward: 18,
    moneyReward: 10,
  },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateDailyQuests(stats: AvatarStats, dateStr?: string): DailyQuest[] {
  const date = dateStr ?? new Date().toDateString();
  const seed = date.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const now = new Date().toISOString();

  const categories: QuestCategory[] = ["survie", "social", "progression"];

  // Adapt based on player state
  if (stats.money < 50) {
    categories[2] = "progression"; // prioritize work if broke
  } else if (stats.sociability < 40) {
    categories[1] = "social"; // prioritize social if isolated
  } else if (stats.energy < 40) {
    categories[0] = "survie"; // prioritize rest if exhausted
  } else {
    // Rotate the 3rd category daily
    const extras: QuestCategory[] = ["explore", "progression", "social", "survie"];
    categories[2] = extras[Math.floor(seededRandom(seed) * extras.length)];
  }

  const quests: DailyQuest[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < 3; i++) {
    const cat = categories[i];
    const pool = QUEST_POOL.filter((q) => q.category === cat);
    let idx = Math.floor(seededRandom(seed + i * 7 + 31) * pool.length);
    // avoid duplicate
    let attempts = 0;
    while (usedIds.has(pool[idx]?.actionId ?? "") && attempts < pool.length) {
      idx = (idx + 1) % pool.length;
      attempts++;
    }
    const template = pool[idx] ?? pool[0];
    usedIds.add(template.actionId);
    quests.push({
      ...template,
      id: `quest-${date}-${i}-${template.actionId}`,
      completed: false,
      claimed: false,
      createdAt: now,
    });
  }

  return quests;
}

export function checkQuestCompletion(
  quests: DailyQuest[],
  actionId: string
): DailyQuest[] {
  return quests.map((q) =>
    !q.completed && (q.actionId === actionId || isQuestTriggeredBy(q.actionId, actionId))
      ? { ...q, completed: true }
      : q
  );
}

function isQuestTriggeredBy(questActionId: string, performedAction: string): boolean {
  const MAPPINGS: Record<string, string[]> = {
    "healthy-meal":   ["healthy-meal", "home-cooking", "comfort-meal"],
    "sleep":          ["sleep", "nap"],
    "shower":         ["shower", "reset"],
    "walk":           ["walk"],
    "meditate":       ["meditate"],
    "cafe-chat":      ["cafe-chat"],
    "team-sport":     ["team-sport", "gym"],
    "talk-npc":       ["cafe-chat", "team-sport", "cinema-date", "restaurant-outing"],
    "go-out":         ["go-out", "restaurant-outing", "cinema-date"],
    "work-shift":     ["work-shift", "focus-task"],
    "gym":            ["gym", "walk", "team-sport"],
    "read-book":      ["read-book"],
    "home-cooking":      ["home-cooking"],
    "appear-on-map":     ["appear-on-map", "publish-position"],
    "map-encounter":     ["map-encounter"],
    "visit-3-districts": ["visit-3-districts"],
    "join-flash-event":  ["join-flash-event"],
    "defend-crew-zone":  ["defend-crew-zone"],
    "travel":            ["travel", "appear-on-map", "publish-position"],
    "send-invite":       ["send-invite", "cafe-chat"],
  };
  const triggers = MAPPINGS[questActionId];
  return triggers ? triggers.includes(performedAction) : false;
}

export function getTodayQuestKey(): string {
  return new Date().toDateString();
}
