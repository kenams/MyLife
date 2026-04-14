import { activities, dailyGoalLabels, jobs, locations, neighborhoods, starterResidents } from "@/lib/game-data";
import { buildAdvice } from "@/lib/selectors";
import type {
  AdviceItem,
  AvatarProfile,
  AvatarStats,
  Conversation,
  DailyGoal,
  InvitationRecord,
  LifeActionId,
  LifeFeedItem,
  MentalStabilityState,
  NotificationItem,
  RelationshipQuality,
  RelationshipRecord
} from "@/lib/types";

export const DEFAULT_LOCATION = "home";
export const DEFAULT_NEIGHBORHOOD = "central-district";
export const CRITICAL_THRESHOLD = 18;

export function clampStat(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampMoney(value: number) {
  return Math.max(0, Math.round(value));
}

export function clampWeight(value: number) {
  return Math.max(42, Math.min(180, Math.round(value * 10) / 10));
}

export function nowIso() {
  return new Date().toISOString();
}

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function seededDailyGoals(): DailyGoal[] {
  return dailyGoalLabels.map((label, index) => ({
    id: `goal-${index + 1}`,
    label,
    completed: false
  }));
}

export function seededRelationships(): RelationshipRecord[] {
  const startedAt = nowIso();
  return starterResidents.map((resident, index) => ({
    residentId: resident.id,
    status: "contact" as const,
    score: index === 0 ? 38 : index === 3 ? 32 : 22,
    quality: "neutre" as const,
    influence: "neutre" as const,
    lastInteractionAt: startedAt,
    isFollowing: resident.id === "ava"
  }));
}

export function createLocalConversation(locationSlug = "cafe"): Conversation {
  const location = locations.find((item) => item.slug === locationSlug) ?? locations[0];
  return {
    id: `local-${location.slug}`,
    peerId: null,
    title: `${location.name} channel`,
    subtitle: "conversation locale",
    kind: "local",
    locationSlug: location.slug,
    unreadCount: 0,
    messages: [
      {
        id: `${location.slug}-seed`,
        authorId: "ava",
        body: "Bienvenue. Garde tes besoins stables et reste visible socialement si tu veux vraiment monter.",
        createdAt: nowIso(),
        read: true,
        kind: "system"
      }
    ]
  };
}

export function seededConversations(): Conversation[] {
  return [createLocalConversation("cafe")];
}

export function seededNotifications(): NotificationItem[] {
  const createdAt = nowIso();
  return [
    {
      id: "welcome-notification",
      kind: "tip",
      title: "Bienvenue dans MyLife",
      body: "Le meilleur debut reste simple : mange, travaille, parle a quelqu'un, puis reviens plus tard.",
      createdAt,
      read: false
    }
  ];
}

export function seededFeed(): LifeFeedItem[] {
  return [
    {
      id: "feed-start",
      title: "Base de vie activee",
      body: "Ton quartier attend surtout de la regularite. Le score social monte lentement, mais il tient mieux.",
      createdAt: nowIso()
    }
  ];
}

export function deriveAttractiveness(stats: AvatarStats): number {
  // Attractiveness = cohérence + santé + soin + stabilité, pas "beau = mieux"
  const base =
    stats.fitness * 0.28 +
    stats.hygiene * 0.24 +
    (100 - stats.stress) * 0.18 +
    stats.discipline * 0.16 +
    stats.mood * 0.14;
  return clampStat(base);
}

export function deriveMentalStability(stats: AvatarStats): MentalStabilityState {
  const stressHigh = stats.stress > 72;
  const moodLow = stats.mood < 32;
  const energyLow = stats.energy < 28;
  const streakLow = stats.streak < 2;

  const negatives = [stressHigh, moodLow, energyLow, streakLow].filter(Boolean).length;
  if (negatives >= 3) return "sature";
  if (negatives >= 1) return "fragile";
  return "stable";
}

export function deriveRelationshipQuality(
  score: number,
  stats: AvatarStats,
  residentReputation: number
): RelationshipQuality {
  // Qualité basée sur le score du lien et le mode de vie de l'avatar
  const lifestyleScore =
    stats.discipline * 0.3 +
    stats.mood * 0.25 +
    (100 - stats.stress) * 0.25 +
    stats.motivation * 0.2;

  if (score >= 70 && lifestyleScore > 60) return "inspirante";
  if (score >= 45 && lifestyleScore > 45) return "stable";
  if (score >= 25) return "neutre";
  // Mauvaises fréquentations : bas score + réputation résident faible
  if (residentReputation < 50 && stats.discipline < 40) return "toxique";
  return "fatigante";
}

export function deriveSocialRankScore(stats: AvatarStats) {
  const moneyScore = Math.min(100, stats.money / 4);
  const composite =
    moneyScore * 0.22 +
    stats.discipline * 0.18 +
    stats.reputation * 0.16 +
    stats.sociability * 0.12 +
    stats.hygiene * 0.12 +
    stats.fitness * 0.1 +
    stats.health * 0.1 +
    stats.motivation * 0.1;

  return clampStat(composite);
}

export function normalizeStats(stats: AvatarStats): AvatarStats {
  const clamped = {
    ...stats,
    hunger: clampStat(stats.hunger),
    hydration: clampStat(stats.hydration),
    energy: clampStat(stats.energy),
    hygiene: clampStat(stats.hygiene),
    mood: clampStat(stats.mood),
    sociability: clampStat(stats.sociability),
    health: clampStat(stats.health),
    fitness: clampStat(stats.fitness),
    stress: clampStat(stats.stress),
    money: clampMoney(stats.money),
    reputation: clampStat(stats.reputation),
    discipline: clampStat(stats.discipline),
    motivation: clampStat(stats.motivation),
    weight: clampWeight(stats.weight),
    streak: Math.max(0, Math.round(stats.streak))
  };
  return {
    ...clamped,
    socialRankScore: deriveSocialRankScore(clamped),
    attractiveness: deriveAttractiveness(clamped),
    mentalStability: deriveMentalStability(clamped)
  };
}

export function createStatsFromAvatar(avatar?: AvatarProfile | null): AvatarStats {
  const baseWeight = avatar?.weightKg ?? 72;
  const disciplineBoost = avatar?.personalityTrait === "Discipline" ? 8 : avatar?.personalityTrait === "Strategique" ? 5 : 0;
  const motivationBoost = avatar?.ambition === "elite" ? 9 : avatar?.ambition === "croissance" ? 6 : 3;
  const socialBoost = avatar?.sociabilityStyle === "tres social" ? 9 : avatar?.sociabilityStyle === "ouvert" ? 5 : 0;
  const now = nowIso();

  return normalizeStats({
    hunger: 76,
    hydration: 72,
    energy: 80,
    hygiene: 78,
    mood: 74,
    sociability: 60 + socialBoost,
    health: 76,
    fitness: avatar?.lifeHabit === "sport" ? 68 : 54,
    stress: avatar?.lifeRhythm === "tardif" ? 34 : 28,
    money: 180,
    socialRankScore: 45,
    attractiveness: 50,
    mentalStability: "stable",
    reputation: avatar?.personalityTrait === "Leader" ? 56 : 50,
    discipline: 50 + disciplineBoost,
    motivation: 56 + motivationBoost,
    weight: baseWeight,
    streak: 0,
    lastDecayAt: now,
    lastMealAt: addHours(now, -3),
    lastWorkoutAt: addHours(now, -30),
    lastSocialAt: addHours(now, -8)
  });
}

export function appendNotification(items: NotificationItem[], notification: NotificationItem) {
  return [notification, ...items].slice(0, 30);
}

export function appendFeed(items: LifeFeedItem[], item: LifeFeedItem) {
  return [item, ...items].slice(0, 30);
}

export function updateGoal(goals: DailyGoal[], keywords: string[]) {
  return goals.map((goal) =>
    keywords.some((keyword) => goal.label.toLowerCase().includes(keyword)) ? { ...goal, completed: true } : goal
  );
}

export function applyDecay(stats: AvatarStats) {
  const now = Date.now();
  const last = new Date(stats.lastDecayAt).getTime();
  const elapsedHours = Math.max(0, (now - last) / (1000 * 60 * 60));

  if (elapsedHours < 0.35) {
    return normalizeStats(stats);
  }

  const hunger = stats.hunger - elapsedHours * 5.4;
  const hydration = stats.hydration - elapsedHours * 6.2;
  const energy = stats.energy - elapsedHours * 4.6;
  const hygiene = stats.hygiene - elapsedHours * 2.6;
  const sociability = stats.sociability - elapsedHours * 3.5;
  const stressBase = stats.stress + elapsedHours * 2.1;
  const moodPenalty =
    (hunger < 30 ? 6 : 0) +
    (hydration < 30 ? 5 : 0) +
    (energy < 25 ? 8 : 0) +
    (sociability < 24 ? 7 : 0) +
    (hygiene < 24 ? 4 : 0) +
    (stressBase > 70 ? 7 : 0);

  const mood = stats.mood - elapsedHours * 2.3 - moodPenalty;
  const healthPenalty = [hunger, hydration, energy].filter((value) => value < CRITICAL_THRESHOLD).length * 4;
  const health = stats.health - elapsedHours * 0.9 - healthPenalty;
  const fitness = stats.fitness - elapsedHours * 0.35;
  const discipline = stats.discipline - elapsedHours * 0.25;
  const motivation = stats.motivation - elapsedHours * 1.2 - (mood < 35 ? 6 : 0);

  return normalizeStats({
    ...stats,
    hunger,
    hydration,
    energy,
    hygiene,
    sociability,
    stress: stressBase,
    mood,
    health,
    fitness,
    discipline,
    motivation,
    lastDecayAt: new Date(now).toISOString()
  });
}

export function buildAutomaticNotifications(stats: AvatarStats, existing: NotificationItem[]) {
  const notifications = [...existing];
  const createdAt = nowIso();
  const hasUnreadOfKind = (kind: NotificationItem["kind"], title: string) =>
    notifications.some((item) => item.kind === kind && item.title === title && !item.read);

  if (stats.hunger < CRITICAL_THRESHOLD && !hasUnreadOfKind("needs", "Ton avatar a faim")) {
    notifications.unshift({
      id: `needs-hunger-${createdAt}`,
      kind: "needs",
      title: "Ton avatar a faim",
      body: "Un bon repas maintenant evitera une chute nette d'humeur et d'energie.",
      createdAt,
      read: false
    });
  }

  if (stats.energy < CRITICAL_THRESHOLD && !hasUnreadOfKind("needs", "Fatigue forte")) {
    notifications.unshift({
      id: `needs-energy-${createdAt}`,
      kind: "needs",
      title: "Fatigue forte",
      body: "Tu as une vraie fenetre de recuperation a prendre. Dormir maintenant est plus rentable que forcer.",
      createdAt,
      read: false
    });
  }

  if (stats.sociability < CRITICAL_THRESHOLD && !hasUnreadOfKind("social", "Relance sociale utile")) {
    notifications.unshift({
      id: `social-low-${createdAt}`,
      kind: "social",
      title: "Relance sociale utile",
      body: "Une sortie courte ou un message a quelqu'un ferait remonter ton humeur et ta visibilite.",
      createdAt,
      read: false
    });
  }

  if (stats.money < 40 && !hasUnreadOfKind("work", "Opportunite de travail")) {
    notifications.unshift({
      id: `work-low-${createdAt}`,
      kind: "work",
      title: "Opportunite de travail",
      body: "Ton budget devient serre. Un shift rapide ou une tache focus est la meilleure priorite.",
      createdAt,
      read: false
    });
  }

  return notifications.slice(0, 30);
}

export function ensureLocalConversation(conversations: Conversation[], locationSlug: string) {
  const localConversationId = `local-${locationSlug}`;
  if (conversations.some((item) => item.id === localConversationId)) {
    return conversations;
  }
  return [...conversations, createLocalConversation(locationSlug)];
}

export function updateRelationshipScore(
  relationships: RelationshipRecord[],
  residentId: string,
  scoreDelta: number,
  stats: AvatarStats,
  residentReputation: number,
  status?: RelationshipRecord["status"]
) {
  const createdAt = nowIso();
  return relationships.map((item) => {
    if (item.residentId !== residentId) return item;
    const newScore = clampStat(item.score + scoreDelta);
    const quality = deriveRelationshipQuality(newScore, stats, residentReputation);
    // Influence : si la relation est inspirante ou stable → positive, si fatigante/toxique → negative
    const influence: RelationshipRecord["influence"] =
      quality === "inspirante" || quality === "stable"
        ? "positive"
        : quality === "toxique" || quality === "fatigante"
          ? "negative"
          : "neutre";
    return {
      ...item,
      score: newScore,
      status: status ?? item.status,
      quality,
      influence,
      lastInteractionAt: createdAt
    };
  });
}

export function createFeedFromAction(action: LifeActionId) {
  const createdAt = nowIso();
  if (action === "healthy-meal") {
    return {
      id: `feed-${createdAt}`,
      title: "Routine alimentaire propre",
      body: "Tu as choisi une action simple qui soutient energie, budget et discipline.",
      createdAt
    };
  }
  if (action === "gym") {
    return {
      id: `feed-${createdAt}`,
      title: "Session discipline validee",
      body: "La forme physique progresse lentement, mais elle tire aussi l'image personnelle vers le haut.",
      createdAt
    };
  }
  if (action === "work-shift") {
    return {
      id: `feed-${createdAt}`,
      title: "Session de travail terminee",
      body: "Argent, reputation et discipline montent mieux quand ta routine reste stable.",
      createdAt
    };
  }
  return {
    id: `feed-${createdAt}`,
    title: "Nouvelle action enregistree",
    body: "Chaque petite action renforce ou fragilise ta trajectoire. La somme compte plus que l'intensite.",
    createdAt
  };
}

export function applyActivityToStats(stats: AvatarStats, activitySlug: string) {
  const activity = activities.find((item) => item.slug === activitySlug);
  if (!activity) {
    return normalizeStats(stats);
  }

  return normalizeStats({
    ...stats,
    money: clampMoney(stats.money - activity.cost),
    energy: stats.energy + activity.energyDelta,
    mood: stats.mood + activity.moodDelta,
    sociability: stats.sociability + activity.sociabilityDelta,
    fitness: stats.fitness + activity.fitnessDelta,
    stress: stats.stress + activity.stressDelta,
    weight: stats.weight + activity.weightDelta,
    discipline: stats.discipline + activity.disciplineDelta,
    reputation: stats.reputation + (activity.kind === "romantic" ? 2 : 1),
    motivation: stats.motivation + (activity.kind === "wellness" ? 5 : 3),
    lastDecayAt: nowIso(),
    lastSocialAt: nowIso(),
    lastWorkoutAt: activity.kind === "wellness" ? nowIso() : stats.lastWorkoutAt
  });
}

export function createInitialRuntime() {
  const stats = createStatsFromAvatar(null);
  return {
    stats,
    currentLocationSlug: DEFAULT_LOCATION,
    currentNeighborhoodSlug: DEFAULT_NEIGHBORHOOD,
    conversations: seededConversations(),
    dailyGoals: seededDailyGoals(),
    lastRewardAt: null as string | null,
    notifications: seededNotifications(),
    advice: buildAdvice(stats),
    relationships: seededRelationships(),
    invitations: [] as InvitationRecord[],
    lifeFeed: seededFeed()
  };
}

export { activities, jobs, locations, neighborhoods, starterResidents };
