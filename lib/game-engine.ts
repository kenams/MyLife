import { activities, dailyGoalLabels, jobs, locations, neighborhoods, starterResidents } from "@/lib/game-data";
import { buildAdvice } from "@/lib/selectors";
import type {
  AdviceItem,
  AvatarProfile,
  AvatarStats,
  Conversation,
  ConversationMessage,
  DailyGoal,
  InvitationRecord,
  LifeActionId,
  LifeFeedItem,
  MentalStabilityState,
  NotificationItem,
  OutingConfig,
  OutingResult,
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

// ─── Resident Social Feed ────────────────────────────────────────────────────

const RESIDENT_MESSAGES: Record<string, (stats: AvatarStats) => string> = {
  ava: (stats) => {
    if (stats.sociability < 35) return "Le silence ne t'aide pas. Reprends contact avec quelqu'un aujourd'hui — n'importe quoi de simple.";
    if (stats.stress > 68) return "Un cafe, pas un objectif. Laisse la pression de cote une heure.";
    if (stats.discipline > 62) return "Je vois que tu tiens. C'est ca qui fait la difference dans le temps.";
    return "Le lien se construit dans les petits moments, pas les grands gestes. Continue.";
  },
  malik: (stats) => {
    if (stats.money < 55) return "Les ressources basses, c'est le moment de consolider, pas de depenser.";
    if (stats.discipline < 38) return "Pas de regularite, pas de credibilite. Simple.";
    if (stats.discipline > 65 && stats.money > 120) return "Bien. Convertis ca en reseau ou en niveau superieur, pas juste en routine.";
    return "Le travail est un outil. Ceux qui le maitrisent choisissent mieux leur cercle.";
  },
  noa: (stats) => {
    if (stats.mood < 42) return "L'energie se voit avant de s'entendre. Remets ton humeur en place.";
    if (stats.hygiene > 72 && stats.fitness > 55) return "Tu rayonnes bien aujourd'hui. C'est le bon moment pour sortir.";
    if (stats.attractiveness < 42) return "L'image est un langage. Travaille-la comme tu travailles le reste.";
    return "Le style, ce n'est pas ce que tu portes. C'est comment tu tiens dans un espace.";
  },
  leila: (stats) => {
    if (stats.stress > 68) return "Marche 10 minutes avant de resoudre quoi que ce soit. L'ordre fait tout.";
    if (stats.fitness > 58) return "Tu progresses bien. Continue meme quand c'est lent — c'est ca qui compte.";
    if (stats.energy < 38) return "Ton corps te parle. Ecoute-le avant de forcer quoi que ce soit.";
    return "Un rythme sain se construit ici, dans les petites sorties regulieres.";
  },
  yan: (stats) => {
    if (stats.streak < 2) return "Pas de serie, pas de traction. Reviens demain si aujourd'hui est dur.";
    if (stats.discipline > 68 && stats.streak > 3) return "Bien. Maintenant ajoute une couche — reseau ou apprentissage.";
    if (stats.motivation < 42) return "La motivation ne precede pas l'action. C'est l'inverse. Fais d'abord.";
    return "Ce qui compte : es-tu meilleur qu'hier ? Rien d'autre.";
  },
  sana: (stats) => {
    if (stats.fitness < 38) return "Tu es en dessous de ta forme. Commence leger — ne saute pas la seance.";
    if (stats.fitness > 68) return "Bien maintenu. Regarde aussi la recuperation — c'est la que la progression se fixe.";
    if (stats.stress > 68) return "20 minutes de sport reduisent le cortisol. C'est physio, pas metaphore.";
    return "La constance bat l'intensite. Une seance legere vaut mieux qu'une absence.";
  }
};

// Résident principal par lieu (pour les messages de channel)
const LOCATION_RESIDENT: Record<string, string> = {
  cafe:       "ava",
  office:     "yan",
  park:       "leila",
  gym:        "sana",
  restaurant: "noa"
};

// Activité préférée par résident pour les invitations proactives
const RESIDENT_INVITE_ACTIVITY: Record<string, string> = {
  ava:   "coffee-meetup",
  malik: "group-outing",
  noa:   "restaurant-date",
  leila: "evening-walk",
  yan:   "coffee-meetup",
  sana:  "group-outing"
};

export function buildResidentVisitMessage(locationSlug: string, stats: AvatarStats): ConversationMessage | null {
  const residentId = LOCATION_RESIDENT[locationSlug];
  if (!residentId) return null;
  const fn = RESIDENT_MESSAGES[residentId];
  if (!fn) return null;
  return {
    id: `resident-visit-${residentId}-${Date.now()}`,
    authorId: residentId,
    body: fn(stats),
    createdAt: nowIso(),
    read: false,
    kind: "message"
  };
}

export function tryGenerateResidentInvitation(
  stats: AvatarStats,
  relationships: RelationshipRecord[],
  invitations: InvitationRecord[]
): InvitationRecord | null {
  // Max 1 pending resident-initiated invitation at a time
  const alreadyPending = invitations.some(
    (inv) => inv.status === "pending" && inv.id.startsWith("resident-invite-")
  );
  if (alreadyPending) return null;

  const pendingResidentIds = new Set(
    invitations.filter((inv) => inv.status === "pending").map((inv) => inv.residentId)
  );

  // Eligible: score > 25, no pending invitation from them already
  const eligible = relationships
    .filter((rel) => rel.score > 25 && !pendingResidentIds.has(rel.residentId))
    .sort((a, b) => b.score - a.score);

  for (const rel of eligible) {
    const resident = starterResidents.find((r) => r.id === rel.residentId);
    if (!resident) continue;

    const activitySlug = RESIDENT_INVITE_ACTIVITY[resident.id];
    if (!activitySlug) continue;

    // Stat threshold per resident
    if (resident.id === "malik" && stats.discipline < 45) continue;
    if (resident.id === "yan" && stats.discipline < 55) continue;
    if (resident.id === "noa" && stats.mood < 45) continue;
    if (resident.id === "sana" && stats.fitness < 40) continue;

    return {
      id: `resident-invite-${resident.id}-${Date.now()}`,
      residentId: resident.id,
      residentName: resident.name,
      activitySlug,
      status: "pending" as const,
      createdAt: nowIso()
    };
  }
  return null;
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

// Multiplicateurs selon intensité
const INTENSITY_MULT = {
  chill:    { energy: 0.5,  mood: 0.7,  social: 0.6, stress: 0.5, budget: 0.6, discipline: 1.2 },
  normale:  { energy: 1.0,  mood: 1.0,  social: 1.0, stress: 1.0, budget: 1.0, discipline: 1.0 },
  festive:  { energy: 1.8,  mood: 1.5,  social: 1.6, stress: 2.0, budget: 1.8, discipline: 0.4 }
} as const;

// Bonus/malus selon contexte
const CONTEXT_MOD = {
  solo:       { mood: -2, social: -8,  stress: -4, discipline: +4, qualityBonus: 0 },
  amis:       { mood: +4, social: +6,  stress: -4, discipline: 0,  qualityBonus: 10 },
  romantique: { mood: +8, social: +4,  stress: -6, discipline: -1, qualityBonus: 20 },
  groupe:     { mood: +4, social: +12, stress: +6, discipline: -3, qualityBonus: -10 }
} as const;

export function resolveOutingResult(config: OutingConfig, stats: AvatarStats): OutingResult {
  const activity = activities.find((a) => a.slug === config.activitySlug);
  if (!activity) {
    return {
      label: "Sortie inconnue",
      energyCost: 0, moodGain: 0, sociabilityGain: 0,
      stressDelta: 0, budgetCost: 0, disciplineDelta: 0,
      weightDelta: 0, fitnessDelta: 0, socialQualityHint: "moyenne"
    };
  }

  const im = INTENSITY_MULT[config.intensity];
  const cm = CONTEXT_MOD[config.context];

  const energyCost  = Math.round(Math.abs(activity.energyDelta) * im.energy);
  const moodGain    = Math.round(activity.moodDelta * im.mood + cm.mood);
  const sociabilityGain = Math.round(activity.sociabilityDelta * im.social + cm.social);
  const stressDelta = Math.round(activity.stressDelta * im.stress + cm.stress);
  const budgetCost  = Math.round(activity.cost * im.budget);
  const disciplineDelta = Math.round(activity.disciplineDelta * im.discipline + cm.discipline);
  const weightDelta = activity.weightDelta;
  const fitnessDelta = activity.fitnessDelta;

  // Qualité sociale = dépend du mode de vie + contexte + discipline
  const lifestyleScore = stats.discipline * 0.4 + stats.mood * 0.3 + (100 - stats.stress) * 0.3;
  const qualityScore = lifestyleScore + cm.qualityBonus;
  const socialQualityHint: OutingResult["socialQualityHint"] =
    qualityScore > 65 ? "haute" : qualityScore > 40 ? "moyenne" : "basse";

  const intensityLabel =
    config.intensity === "festive" ? "Soiree festive" :
    config.intensity === "chill"   ? "Sortie chill" : "Sortie normale";
  const contextLabel =
    config.context === "romantique" ? "en mode romantique" :
    config.context === "groupe"     ? "en groupe" :
    config.context === "amis"       ? "entre amis" : "en solo";

  return {
    label: `${activity.name} — ${intensityLabel} ${contextLabel}`,
    energyCost, moodGain, sociabilityGain,
    stressDelta, budgetCost, disciplineDelta,
    weightDelta, fitnessDelta, socialQualityHint
  };
}

export function applyOutingToStats(stats: AvatarStats, result: OutingResult): AvatarStats {
  return normalizeStats({
    ...stats,
    energy:      stats.energy - result.energyCost,
    mood:        stats.mood + result.moodGain,
    sociability: stats.sociability + result.sociabilityGain,
    stress:      stats.stress + result.stressDelta,
    money:       clampMoney(stats.money - result.budgetCost),
    discipline:  stats.discipline + result.disciplineDelta,
    weight:      stats.weight + result.weightDelta,
    fitness:     stats.fitness + result.fitnessDelta,
    reputation:  stats.reputation + (result.socialQualityHint === "haute" ? 3 : result.socialQualityHint === "moyenne" ? 1 : 0),
    motivation:  stats.motivation + (result.moodGain > 10 ? 4 : 2),
    lastDecayAt: nowIso(),
    lastSocialAt: nowIso()
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
