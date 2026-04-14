import { activities, dailyGoalLabels, jobs, locations, neighborhoods, starterResidents } from "@/lib/game-data";
import { buildAdvice, getDateVenueLabel, getMomentumState } from "@/lib/selectors";
import type {
  AdviceItem,
  AvatarProfile,
  AvatarStats,
  Conversation,
  ConversationMessage,
  DatePlan,
  DateVenueKind,
  DailyEvent,
  DailyEventEffects,
  DailyGoal,
  InvitationRecord,
  LifeActionId,
  LifeFeedItem,
  LifePattern,
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
    if (stats.socialRankScore >= 70) return "Tu fais vraiment partie du quartier maintenant. Reste present et aide les nouveaux — c'est ca le vrai rang.";
    if (stats.socialRankScore < 28) return "Tu debarques. Commence petit — un cafe, un sourire, une regularite. C'est tout ce qu'il faut.";
    if (stats.sociability < 35) return "Le silence ne t'aide pas. Reprends contact avec quelqu'un aujourd'hui — n'importe quoi de simple.";
    if (stats.stress > 68) return "Un cafe, pas un objectif. Laisse la pression de cote une heure.";
    if (stats.discipline > 62) return "Je vois que tu tiens. C'est ca qui fait la difference dans le temps.";
    return "Le lien se construit dans les petits moments, pas les grands gestes. Continue.";
  },
  malik: (stats) => {
    if (stats.socialRankScore >= 75) return "Tu es maintenant dans la zone ou les opportunites s'ouvrent d'elles-memes. Ne relache pas.";
    if (stats.socialRankScore < 30) return "Le rang se construit par les actes, pas les intentions. Montre ce que tu fais.";
    if (stats.money < 55) return "Les ressources basses, c'est le moment de consolider, pas de depenser.";
    if (stats.discipline < 38) return "Pas de regularite, pas de credibilite. Simple.";
    if (stats.discipline > 65 && stats.money > 120) return "Bien. Convertis ca en reseau ou en niveau superieur, pas juste en routine.";
    return "Le travail est un outil. Ceux qui le maitrisent choisissent mieux leur cercle.";
  },
  noa: (stats) => {
    if (stats.socialRankScore >= 72) return "Ton image est coherente avec ton rang. Ca change la façon dont les gens t'approchent.";
    if (stats.socialRankScore < 28) return "L'image precede souvent la realite. Travaille ce que les autres voient en premier.";
    if (stats.mood < 42) return "L'energie se voit avant de s'entendre. Remets ton humeur en place.";
    if (stats.hygiene > 72 && stats.fitness > 55) return "Tu rayonnes bien aujourd'hui. C'est le bon moment pour sortir.";
    if (stats.attractiveness < 42) return "L'image est un langage. Travaille-la comme tu travailles le reste.";
    return "Le style, ce n'est pas ce que tu portes. C'est comment tu tiens dans un espace.";
  },
  leila: (stats) => {
    if (stats.socialRankScore >= 70) return "Tu rayonnes d'un equilibre rare ici. Continue de prendre soin de ce rythme — ca se voit.";
    if (stats.socialRankScore < 28) return "Tout commence par le corps. Un peu de mouvement chaque jour stabilise tout le reste.";
    if (stats.stress > 68) return "Marche 10 minutes avant de resoudre quoi que ce soit. L'ordre fait tout.";
    if (stats.fitness > 58) return "Tu progresses bien. Continue meme quand c'est lent — c'est ca qui compte.";
    if (stats.energy < 38) return "Ton corps te parle. Ecoute-le avant de forcer quoi que ce soit.";
    return "Un rythme sain se construit ici, dans les petites sorties regulieres.";
  },
  yan: (stats) => {
    if (stats.socialRankScore >= 80) return "Tu as prouve que tu peux tenir. Maintenant leverages ce que tu as construit — c'est la que ca devient interessant.";
    if (stats.socialRankScore < 30) return "Ici, on juge sur la duree. Reviens regulierement et montre que tu tiens.";
    if (stats.streak < 2) return "Pas de serie, pas de traction. Reviens demain si aujourd'hui est dur.";
    if (stats.discipline > 68 && stats.streak > 3) return "Bien. Maintenant ajoute une couche — reseau ou apprentissage.";
    if (stats.motivation < 42) return "La motivation ne precede pas l'action. C'est l'inverse. Fais d'abord.";
    return "Ce qui compte : es-tu meilleur qu'hier ? Rien d'autre.";
  },
  sana: (stats) => {
    if (stats.socialRankScore >= 72) return "Ta constance se voit. Tu es maintenant un exemple pour ceux qui debutent ici.";
    if (stats.socialRankScore < 28) return "Le corps est le premier investissement. Tout le reste vient apres.";
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

// ─── Resident Chat Replies ────────────────────────────────────────────────────

const RESIDENT_REPLIES: Record<string, string[]> = {
  ava: [
    "Je vois ca. Continue — la constance fait plus que les grands efforts ponctuels.",
    "C'est un bon signe. Reviens me parler si quelque chose coince.",
    "Bien. Une sortie simple bientot ferait du bien aussi.",
    "Le quartier evolue vite. Tiens ton rythme et ca suit.",
    "Tu progresses. Garde ca discret — ceux qui crient fort avancent moins.",
    "Je note. Et toi, comment tu te sens vraiment en ce moment ?"
  ],
  malik: [
    "Compact. Montre les resultats, pas les intentions.",
    "Bien. Maintenant execute — la conversation ne remplace pas l'action.",
    "C'est le bon angle. Reste dessus.",
    "Interessant. Reviens quand tu as quelque chose de concret a montrer.",
    "Je retiens. Les profils qui agissent d'abord parlent apres — c'est ca qui impressionne ici.",
    "Ok. Si tu veux avancer plus vite, travaille la discipline d'abord."
  ],
  noa: [
    "J'aime ca. L'energie que tu degages en ce moment est reelle.",
    "Sympa. Faudrait se croiser bientot — un cafe ou autre chose.",
    "Ca colle bien avec ce que tu projettes. Reste authentique.",
    "Interessant. Tu as un vrai truc — beaucoup ici ne voient pas ca.",
    "Je vois ou tu vas. C'est plutot bien.",
    "Haha ok. On devrait vraiment se voir plutot que juste ecrire."
  ],
  leila: [
    "Ca fait plaisir d'entendre ca. Continue a prendre soin de toi aussi.",
    "Bien. Une marche ensemble ca te dirait un de ces soirs ?",
    "Le corps et le mental avancent ensemble. Tu le ressens ?",
    "Je suis contente que tu partages ca. Garde ce rythme.",
    "Tu progresses vraiment. Ca se voit dans comment tu tiens.",
    "Simple et efficace. C'est tout ce qu'il faut."
  ],
  yan: [
    "Court et clair. C'est le bon format.",
    "Note. Quand les actes suivent, ca veut dire quelque chose.",
    "Bien. Maintenant fait-le. Parler c'est facile.",
    "Je vois. Ton streak dit plus que tes mots — continue.",
    "Compact. Je prefere ca a de longues explications.",
    "Retenu. Montre-le dans les prochains jours."
  ],
  sana: [
    "Super. Et le sport ce soir ?",
    "Ca m'encourage aussi. La regularite c'est contagieux.",
    "Bien joue. Le corps retient tout ce qu'on lui donne.",
    "Continue. La prochaine seance sera encore mieux.",
    "Je t'entends. Garde juste ca en tete : le repos fait partie du progres aussi.",
    "Ca c'est bien. On se croise au gym bientot ?"
  ]
};

export function buildResidentReply(residentId: string, messageCount: number): ConversationMessage | null {
  const replies = RESIDENT_REPLIES[residentId];
  if (!replies || replies.length === 0) return null;
  const idx = messageCount % replies.length;
  return {
    id: `reply-${residentId}-${Date.now()}`,
    authorId: residentId,
    body: replies[idx],
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

// ─── Streak Milestones ────────────────────────────────────────────────────────

export type StreakReward = {
  day: number;
  label: string;
  effects: { money?: number; mood?: number; discipline?: number; motivation?: number; reputation?: number };
  message: string;
};

const STREAK_MILESTONES: StreakReward[] = [
  {
    day: 3,
    label: "Routine lancee",
    effects: { mood: 10, discipline: 8, motivation: 6 },
    message: "3 jours de suite. La regularite commence a s'installer. Le quartier le remarque deja."
  },
  {
    day: 7,
    label: "Semaine complete",
    effects: { money: 60, mood: 12, discipline: 10, motivation: 10, reputation: 6 },
    message: "7 jours. Une vraie semaine propre. Ton rang social et ta reputation progressent plus vite maintenant."
  },
  {
    day: 14,
    label: "Deux semaines locked-in",
    effects: { money: 100, mood: 15, discipline: 14, motivation: 12, reputation: 10 },
    message: "14 jours. Tu es dans une categorie a part. Le multiplicateur de progression est maintenant a son maximum."
  },
  {
    day: 30,
    label: "Un mois de vie construite",
    effects: { money: 200, mood: 20, discipline: 18, motivation: 16, reputation: 15 },
    message: "30 jours. Mode de vie consolide. Tu attires maintenant des profils de qualite superieure naturellement."
  }
];

export function checkStreakMilestone(streak: number): StreakReward | null {
  return STREAK_MILESTONES.find((m) => m.day === streak) ?? null;
}

export function applyMomentumGain(baseValue: number, stats: AvatarStats) {
  const momentum = getMomentumState(stats);
  return Math.round(baseValue * momentum.multiplier);
}

export function getDateVenueOptions(stats: AvatarStats): DateVenueKind[] {
  const options: DateVenueKind[] = [];

  if (stats.money >= 8) options.push("coffee");
  if (stats.energy >= 34 && stats.stress <= 74) options.push("park");
  if (stats.money >= 18 && stats.energy >= 36) options.push("cinema");
  if (stats.money >= 30 && stats.hygiene >= 48 && stats.mood >= 44) options.push("restaurant");

  return options.length > 0 ? options : ["coffee"];
}

export function getDateActivityForVenue(venueKind: DateVenueKind) {
  if (venueKind === "coffee") return "coffee-meetup";
  if (venueKind === "park") return "evening-walk";
  if (venueKind === "cinema") return "cinema-night";
  return "restaurant-date";
}

export function getDateReadiness(
  stats: AvatarStats,
  relationship: RelationshipRecord | undefined,
  residentId: string
): { allowed: boolean; note: string; venueOptions: DateVenueKind[] } {
  const relationshipScore = relationship?.score ?? 0;
  const isRomanticResident = starterResidents.find((resident) => resident.id === residentId)?.lookingFor.includes("relation amoureuse");
  const venueOptions = getDateVenueOptions(stats);

  if (!isRomanticResident) {
    return {
      allowed: false,
      note: "Ce profil ne cherche pas de relation romantique pour l'instant.",
      venueOptions
    };
  }

  if (relationshipScore < 36) {
    return {
      allowed: false,
      note: "Le lien est encore trop faible. Quelques echanges et une sortie simple d'abord.",
      venueOptions
    };
  }

  if (stats.hygiene < 44 || stats.mood < 40 || stats.sociability < 40) {
    return {
      allowed: false,
      note: "Ton avatar doit d'abord remonter hygiene, humeur et presence sociale.",
      venueOptions
    };
  }

  if (stats.mentalStability === "sature" || stats.energy < 28) {
    return {
      allowed: false,
      note: "Pas le bon timing. Recuperer d'abord augmente la qualite du rendez-vous.",
      venueOptions
    };
  }

  return {
    allowed: true,
    note: "Le lien et ton etat actuel permettent un date propre dans un lieu public.",
    venueOptions
  };
}

export function buildDatePlan(
  residentId: string,
  residentName: string,
  venueKind: DateVenueKind,
  scheduledMoment: string
): DatePlan {
  return {
    id: `date-${residentId}-${Date.now()}`,
    residentId,
    residentName,
    venueKind,
    venueLabel: getDateVenueLabel(venueKind),
    activitySlug: getDateActivityForVenue(venueKind),
    status: "proposed",
    scheduledMoment,
    note: "Lieu public, timing clair, intention simple. L'objectif est un vrai moment propre, pas un forcing.",
    bridgeToRealLife:
      "Si le lien reste bon, tu peux reproduire ce format dans la vraie vie : lieu public, horaire clair, sortie courte et sobre.",
    createdAt: nowIso()
  };
}

export function applyDatePlanToStats(stats: AvatarStats, plan: DatePlan) {
  const activitySlug = getDateActivityForVenue(plan.venueKind);
  const outingResult = resolveOutingResult(
    {
      activitySlug,
      intensity: "chill",
      context: "romantique"
    },
    stats
  );

  return normalizeStats({
    ...applyOutingToStats(stats, outingResult),
    reputation: stats.reputation + 2,
    motivation: stats.motivation + 4,
    lastSocialAt: nowIso(),
    lastDecayAt: nowIso()
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
    datePlans: [] as DatePlan[],
    lifeFeed: seededFeed()
  };
}

// ─── Daily Events ─────────────────────────────────────────────────────────────

type EventTemplate = Omit<DailyEvent, "id" | "createdAt" | "resolved" | "choice"> & {
  patterns: LifePattern[];
};

const EVENT_TEMPLATES: EventTemplate[] = [
  // BURNOUT
  {
    kind: "setback", patterns: ["burnout"],
    title: "Signal d'alarme",
    body: "Ton systeme nerveux envoie des signaux clairs. Forcer maintenant accelere la descente — pas la progression.",
    actionLabel: "Prendre du repos",
    skipLabel: "Ignorer (risque)",
    effects: { energy: 20, stress: -15, mood: 6 },
    skipEffects: { stress: 12, mood: -8, energy: -6 }
  },
  {
    kind: "opportunity", patterns: ["burnout"],
    title: "Proposition legere",
    body: "Un contact propose une collaboration courte — 1h maximum, sans pression, bien remuneree.",
    actionLabel: "Accepter (1h, facile)",
    skipLabel: "Passer",
    effects: { money: 38, energy: -5, discipline: 4 },
    skipEffects: { mood: -3 }
  },
  // SOCIAL_DROUGHT
  {
    kind: "social", patterns: ["social_drought"],
    title: "Message inattendu",
    body: "Un contact reprend de ses nouvelles apres une absence. C'est le bon moment pour repondre.",
    actionLabel: "Repondre maintenant",
    skipLabel: "Lire et passer",
    effects: { sociability: 14, mood: 10, stress: -4 },
    skipEffects: { sociability: 4, mood: 2 }
  },
  {
    kind: "social", patterns: ["social_drought"],
    title: "Evenement de quartier",
    body: "Une sortie locale est organisee ce soir. Accessible, sans pression. Exactement ce qu'il faut.",
    actionLabel: "Y aller",
    skipLabel: "Rester chez soi",
    effects: { sociability: 18, mood: 12, energy: -10 },
    skipEffects: { mood: -5, sociability: -3 }
  },
  // GRIND_MODE
  {
    kind: "opportunity", patterns: ["grind_mode"],
    title: "Proposition business",
    body: "Un contact propose un projet court mais exigeant. Le gain est reel, mais ca demande du focus.",
    actionLabel: "Prendre le projet",
    skipLabel: "Decliner",
    effects: { money: 85, energy: -16, discipline: 6, stress: 8 },
    skipEffects: { stress: -4, mood: 3 }
  },
  {
    kind: "setback", patterns: ["grind_mode"],
    title: "Avertissement corporel",
    body: "Ton corps te rappelle qu'il a des limites. Ignorer ce signal a un cout immediat.",
    actionLabel: "Ecouter et recuperer",
    skipLabel: "Continuer quand meme",
    effects: { energy: 12, stress: -10, mood: 5 },
    skipEffects: { energy: -14, stress: 10 }
  },
  // PRODUCTIVE_ISOLATED
  {
    kind: "social", patterns: ["productive_isolated"],
    title: "Invitation spontanee",
    body: "Quelqu'un dans ton reseau propose une sortie courte. Une heure dehors peut tout changer.",
    actionLabel: "Accepter l'invitation",
    skipLabel: "Rester en mode solo",
    effects: { sociability: 14, mood: 10, energy: -8 },
    skipEffects: { discipline: 2 }
  },
  {
    kind: "encounter", patterns: ["productive_isolated"],
    title: "Reconnaissance externe",
    body: "Un profil remarque ta regularite et commente positivement. Un lien utile peut s'ouvrir.",
    actionLabel: "Entretenir le contact",
    skipLabel: "Ignorer",
    effects: { reputation: 8, mood: 8, sociability: 6, motivation: 6 },
    skipEffects: {}
  },
  // NEGLECT / RECOVERY
  {
    kind: "windfall", patterns: ["neglect", "recovery_needed"],
    title: "Coup de pouce inattendu",
    body: "Une source inattendue t'envoie de quoi couvrir les bases. Pas de condition, juste un reset.",
    actionLabel: "Encaisser",
    skipLabel: "Refuser",
    effects: { money: 28, mood: 10, motivation: 6, energy: 8 },
    skipEffects: {}
  },
  {
    kind: "setback", patterns: ["neglect"],
    title: "Consequence visible",
    body: "Ton mode de vie actuel commence a laisser des traces. Rien de grave — mais le signal est la.",
    actionLabel: "Reconnu et pris en compte",
    skipLabel: "Nier",
    effects: { motivation: 5, discipline: 3 },
    skipEffects: { mood: -8, reputation: -4 }
  },
  // MOMENTUM
  {
    kind: "opportunity", patterns: ["momentum"],
    title: "Opportunite de niveau superieur",
    body: "Une occasion premium s'ouvre — accessible uniquement parce que ton mode de vie est en ordre.",
    actionLabel: "Saisir l'opportunite",
    skipLabel: "Conserver l'energie",
    effects: { money: 95, reputation: 10, energy: -18, discipline: 8 },
    skipEffects: { stress: -4, energy: 6 }
  },
  {
    kind: "encounter", patterns: ["momentum"],
    title: "Rencontre inspirante",
    body: "Tu croises un profil remarquable — le genre de personne qui eleve le niveau du quartier.",
    actionLabel: "Engager la conversation",
    skipLabel: "Laisser passer",
    effects: { sociability: 12, mood: 12, motivation: 10, reputation: 5 },
    skipEffects: { mood: 3 }
  },
  // IMAGE_GAP
  {
    kind: "setback", patterns: ["image_gap"],
    title: "Feedback social direct",
    body: "Ton image exterieure ne colle pas avec le rang que tu vises. Ce n'est pas une critique — c'est une info.",
    actionLabel: "Prendre en compte et agir",
    skipLabel: "Ignorer le signal",
    effects: { discipline: 10, motivation: 6, hygiene: 12 },
    skipEffects: { reputation: -5, mood: -5 }
  },
  {
    kind: "opportunity", patterns: ["image_gap"],
    title: "Occasion de repositionnement",
    body: "Une situation te permet d'ameliorer ton image rapidement — mais elle coute.",
    actionLabel: "Investir dans l'image",
    skipLabel: "Passer",
    effects: { reputation: 10, hygiene: 18, money: -22 },
    skipEffects: {}
  },
  // EQUILIBRE / UNIVERSAL
  {
    kind: "windfall", patterns: ["equilibre", "momentum"],
    title: "Cashback inattendu",
    body: "Une regularite de paiement te rapporte un retour imprévu. Petit mais bienvenu.",
    actionLabel: "Encaisser",
    skipLabel: "N/A",
    effects: { money: 24 },
    skipEffects: {}
  },
  {
    kind: "setback", patterns: ["equilibre", "grind_mode", "productive_isolated"],
    title: "Depense imprevue",
    body: "Une charge non planifiee arrive. Absorbable si le budget est sain, tendu sinon.",
    actionLabel: "Regler la situation",
    skipLabel: "Reporter (risque)",
    effects: { money: -30, stress: 4 },
    skipEffects: { money: -30, stress: 12, reputation: -3 }
  },
  {
    kind: "windfall", patterns: ["equilibre", "productive_isolated", "social_drought"],
    title: "Nuit de qualite",
    body: "Sans raison apparente, tu recuperes mieux que d'habitude. Le corps et le mental en profitent.",
    actionLabel: "Super",
    skipLabel: "N/A",
    effects: { energy: 14, mood: 8, stress: -10 },
    skipEffects: {}
  },
  {
    kind: "social", patterns: ["equilibre"],
    title: "Occasion sociale legere",
    body: "Une sortie simple se presente — sans pression, juste du lien et de la detente.",
    actionLabel: "Rejoindre",
    skipLabel: "Passer cette fois",
    effects: { sociability: 10, mood: 8, energy: -6 },
    skipEffects: { discipline: 2 }
  }
];

export function generateDailyEvent(pattern: LifePattern): DailyEvent {
  const matching = EVENT_TEMPLATES.filter((t) => t.patterns.includes(pattern));
  const pool = matching.length > 0 ? matching : EVENT_TEMPLATES.filter((t) => t.patterns.includes("equilibre"));
  const template = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...template,
    id: `event-${Date.now()}`,
    createdAt: nowIso(),
    resolved: false,
    choice: null
  };
}

export function applyEventEffects(stats: AvatarStats, effects: DailyEventEffects): AvatarStats {
  return normalizeStats({
    ...stats,
    money:       clampMoney((stats.money) + (effects.money ?? 0)),
    energy:      stats.energy      + (effects.energy      ?? 0),
    mood:        stats.mood        + (effects.mood        ?? 0),
    sociability: stats.sociability + (effects.sociability ?? 0),
    stress:      stats.stress      + (effects.stress      ?? 0),
    discipline:  stats.discipline  + (effects.discipline  ?? 0),
    reputation:  stats.reputation  + (effects.reputation  ?? 0),
    fitness:     stats.fitness     + (effects.fitness     ?? 0),
    motivation:  stats.motivation  + (effects.motivation  ?? 0),
    hygiene:     stats.hygiene     + (effects.hygiene     ?? 0),
    lastDecayAt: nowIso()
  });
}

export { activities, jobs, locations, neighborhoods, starterResidents };
