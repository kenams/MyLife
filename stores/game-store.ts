import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  activities,
  applyActivityToStats,
  applyDecay,
  applyEventEffects,
  applyMomentumGain,
  applyOutingToStats,
  applyDatePlanToStats,
  appendFeed,
  appendNotification,
  buildDatePlan,
  buildAutomaticNotifications,
  buildResidentReply,
  buildResidentVisitMessage,
  checkStreakMilestone,
  createFeedFromAction,
  createInitialRuntime,
  seededDailyGoals,
  createStatsFromAvatar,
  ensureLocalConversation,
  getDateReadiness,
  generateDailyEvent,
  jobs,
  locations,
  normalizeStats,
  nowIso,
  resolveOutingResult,
  starterResidents,
  tryGenerateResidentInvitation,
  updateGoal,
  updateRelationshipScore
} from "@/lib/game-engine";
import { buildAdvice, detectLifePattern, getMomentumState, getSocialRankLabel, RANK_ORDER } from "@/lib/selectors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  AvatarProfile,
  Conversation,
  DatePlan,
  DateVenueKind,
  DailyEvent,
  InvitationRecord,
  LifeActionId,
  NotificationItem,
  OutingConfig,
  SocialRank,
  UserSession
} from "@/lib/types";

type TestAccountPreset = "balanced" | "burnout" | "romantic";

type GameState = {
  hasHydrated: boolean;
  session: UserSession | null;
  avatar: AvatarProfile | null;
  stats: ReturnType<typeof createStatsFromAvatar>;
  currentLocationSlug: string;
  currentNeighborhoodSlug: string;
  conversations: Conversation[];
  dailyGoals: ReturnType<typeof createInitialRuntime>["dailyGoals"];
  lastRewardAt: string | null;
  notifications: NotificationItem[];
  advice: ReturnType<typeof createInitialRuntime>["advice"];
  relationships: ReturnType<typeof createInitialRuntime>["relationships"];
  invitations: InvitationRecord[];
  datePlans: DatePlan[];
  dailyEvent: DailyEvent | null;
  lastKnownRank: SocialRank | null;
  lifeFeed: ReturnType<typeof createInitialRuntime>["lifeFeed"];
  signIn: (email: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
  loadTestAccount: (preset?: TestAccountPreset) => void;
  signOut: () => void;
  completeAvatar: (avatar: AvatarProfile) => void;
  editAvatar: (avatar: AvatarProfile) => void;
  bootstrap: () => void;
  performAction: (action: LifeActionId) => void;
  travelTo: (locationSlug: string) => void;
  sendMessage: (conversationId: string, body: string) => void;
  startDirectConversation: (residentId: string, residentName: string) => void;
  sendInvitation: (residentId: string, activitySlug: string) => void;
  respondInvitation: (invitationId: string, status: "accepted" | "declined") => void;
  proposeDate: (residentId: string, residentName: string, venueKind: DateVenueKind) => void;
  respondDatePlan: (datePlanId: string, status: "accepted" | "declined") => void;
  completeDatePlan: (datePlanId: string) => void;
  performOuting: (config: OutingConfig) => void;
  resolveDailyEvent: (choice: "accepted" | "skipped") => void;
  claimDailyReward: () => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  resetAll: () => void;
};

function initialState() {
  const runtime = createInitialRuntime();
  return {
    hasHydrated: false,
    session: null as UserSession | null,
    avatar: null as AvatarProfile | null,
    dailyEvent: null as DailyEvent | null,
    lastKnownRank: null as SocialRank | null,
    ...runtime
  };
}

function getStarterJob(slug: string) {
  return jobs.find((job) => job.slug === slug) ?? jobs[0];
}

function createTestAccountState(preset: TestAccountPreset = "balanced") {
  const runtime = createInitialRuntime();
  const createdAt = nowIso();
  const avatar: AvatarProfile = {
    displayName: "Kenan",
    ageRange: "26-30",
    gender: "Homme",
    originStyle: "Mediterranee",
    photoStyle: "Street premium",
    bio: "Routine stable, ambition claire, recherche des liens utiles, des sorties propres et une progression visible.",
    heightCm: 178,
    weightKg: 74,
    bodyFrame: "athletique",
    skinTone: "ambre",
    hairType: "ondulé",
    hairColor: "noir",
    hairLength: "court",
    eyeColor: "marron",
    outfitStyle: "business",
    facialHair: "barbe courte",
    silhouette: "tonique",
    personalityTrait: "Strategique",
    sociabilityStyle: "ouvert",
    ambition: "croissance",
    lifeRhythm: "equilibre",
    interests: ["business", "coffee", "fitness", "mindset", "networking"],
    leisureStyles: ["fitness", "cinema", "networking"],
    relationshipStyle: "stable",
    personalGoal: "monter socialement",
    lifeHabit: "structure",
    lookingFor: ["amis", "motivation", "relation amoureuse", "sorties"],
    friendshipIntent: "Construire un cercle fiable, present et utile.",
    romanceIntent: "Des rencontres sobres, publiques et avec vrai potentiel.",
    favoriteActivities: ["fitness", "coffee", "cinema"],
    favoriteOutings: ["coffee", "restaurant", "cinema"],
    preferredVibe: "ambitieux",
    appreciatedTraits: ["fiable", "discipline", "douceur"],
    starterJob: "support-tech"
  };

  const baseStats = createStatsFromAvatar(avatar);
  let stats = normalizeStats({
    ...baseStats,
    hunger: 74,
    hydration: 78,
    energy: 83,
    hygiene: 80,
    mood: 76,
    sociability: 71,
    health: 80,
    fitness: 72,
    stress: 29,
    money: 248,
    socialRankScore: 63,
    reputation: 64,
    discipline: 70,
    motivation: 74,
    weight: 74,
    streak: 4,
    lastDecayAt: createdAt,
    lastMealAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    lastWorkoutAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    lastSocialAt: new Date(Date.now() - 1000 * 60 * 55).toISOString()
  });

  const relationships = runtime.relationships.map((item) => {
    if (item.residentId === "ava") {
      return {
        ...item,
        status: "ami" as const,
        score: 58,
        quality: "stable" as const,
        influence: "positive" as const,
        isFollowing: true,
        lastInteractionAt: createdAt
      };
    }

    if (item.residentId === "noa") {
      return {
        ...item,
        status: "crush" as const,
        score: 51,
        quality: "inspirante" as const,
        influence: "positive" as const,
        isFollowing: true,
        lastInteractionAt: createdAt
      };
    }

    if (item.residentId === "leila") {
      return {
        ...item,
        status: "ami" as const,
        score: 46,
        quality: "stable" as const,
        influence: "positive" as const,
        lastInteractionAt: createdAt
      };
    }

    if (item.residentId === "yan") {
      return {
        ...item,
        status: "contact" as const,
        score: 42,
        quality: "stable" as const,
        influence: "positive" as const,
        lastInteractionAt: createdAt
      };
    }

    return {
      ...item,
      score: 34,
      quality: "neutre" as const,
      influence: "neutre" as const,
      lastInteractionAt: createdAt
    };
  });

  const conversations = [
    ...runtime.conversations,
    {
      id: "dm-ava",
      peerId: "ava",
      title: "Ava",
      subtitle: "conversation privee",
      kind: "direct" as const,
      locationSlug: null,
      unreadCount: 1,
      messages: [
        {
          id: "msg-ava-1",
          authorId: "ava",
          body: "Tu tiens un bon rythme. Si tu veux tester le social, commence par une sortie simple.",
          createdAt,
          read: false,
          kind: "message" as const
        },
        {
          id: "msg-ava-2",
          authorId: "self",
          body: "Je garde la ligne. Je vais probablement passer au cafe en fin de journee.",
          createdAt,
          read: true,
          kind: "message" as const
        }
      ]
    },
    {
      id: "dm-noa",
      peerId: "noa",
      title: "Noa",
      subtitle: "conversation privee",
      kind: "direct" as const,
      locationSlug: null,
      unreadCount: 0,
      messages: [
        {
          id: "msg-noa-1",
          authorId: "noa",
          body: "Ton profil est propre. Un cinema ou un cafe pourrait bien se passer.",
          createdAt,
          read: true,
          kind: "message" as const
        }
      ]
    }
  ];

  let invitations: InvitationRecord[] = [
    {
      id: "invite-leila-test",
      residentId: "leila",
      residentName: "Leila",
      activitySlug: "walk",
      status: "pending",
      createdAt
    }
  ];

  let datePlans: DatePlan[] = [
    {
      id: "date-noa-test",
      residentId: "noa",
      residentName: "Noa",
      venueKind: "cinema",
      venueLabel: "Cinema public",
      activitySlug: "cinema-night",
      status: "accepted",
      scheduledMoment: "ce soir, 19:30",
      note: "Sortie sobre et publique pour tester la qualite du lien sans forcer le rythme.",
      bridgeToRealLife: "Si l'echange reste propre, reproduis le meme format dans la vraie vie : lieu public, timing clair, duree courte.",
      createdAt
    }
  ];

  let dailyGoals = runtime.dailyGoals.map((goal) => ({
    ...goal,
    completed:
      goal.label.includes("Manger") ||
      goal.label.includes("Travailler") ||
      goal.label.includes("Parler")
  }));

  let notifications = [
    {
      id: "test-welcome",
      kind: "reward" as const,
      title: "Compte test charge",
      body: "Tu entres avec une vie deja en mouvement : social, dates, travail et momentum actifs.",
      createdAt,
      read: false
    },
    {
      id: "test-date-reminder",
      kind: "social" as const,
      title: "Date confirme ce soir",
      body: "Noa est partant pour une sortie cinema. Tu peux tester tout le flux depuis l'ecran Dates.",
      createdAt,
      read: false
    },
    ...runtime.notifications
  ];

  let lifeFeed = [
    {
      id: "feed-test-start",
      title: "Vie test prechargee",
      body: "Le compte test demarre avec un cercle social, un date prevu et assez de stats pour explorer tout le MVP.",
      createdAt
    },
    ...runtime.lifeFeed
  ];

  if (preset === "burnout") {
    stats = normalizeStats({
      ...stats,
      hunger: 26,
      hydration: 32,
      energy: 18,
      hygiene: 28,
      mood: 29,
      sociability: 21,
      health: 42,
      fitness: 34,
      stress: 84,
      money: 36,
      socialRankScore: 31,
      reputation: 41,
      discipline: 37,
      motivation: 28,
      streak: 1,
      lastMealAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
      lastWorkoutAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      lastSocialAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      lastDecayAt: createdAt
    });
    invitations = [];
    datePlans = [];
    dailyGoals = runtime.dailyGoals;
    notifications = [
      {
        id: "burnout-alert",
        kind: "needs",
        title: "Etat test : surcharge",
        body: "Ce profil sert a valider la recuperation, les alertes, les conseils et les priorites vitales.",
        createdAt,
        read: false
      },
      ...runtime.notifications
    ];
    lifeFeed = [
      {
        id: "feed-burnout-start",
        title: "Profil test sous pression",
        body: "L'avatar demarre en dette physique et sociale. Tu peux tester la remontée, les conseils et le reset de routine.",
        createdAt
      },
      ...runtime.lifeFeed
    ];
  }

  if (preset === "romantic") {
    stats = normalizeStats({
      ...stats,
      hunger: 79,
      hydration: 82,
      energy: 86,
      hygiene: 88,
      mood: 84,
      sociability: 82,
      health: 83,
      fitness: 75,
      stress: 22,
      money: 292,
      socialRankScore: 68,
      reputation: 69,
      discipline: 72,
      motivation: 78,
      streak: 6,
      lastMealAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      lastWorkoutAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
      lastSocialAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      lastDecayAt: createdAt
    });
    invitations = [
      {
        id: "invite-ava-social",
        residentId: "ava",
        residentName: "Ava",
        activitySlug: "coffee-meetup",
        status: "pending",
        createdAt
      }
    ];
    datePlans = [
      {
        id: "date-noa-premium",
        residentId: "noa",
        residentName: "Noa",
        venueKind: "restaurant",
        venueLabel: "Restaurant",
        activitySlug: "restaurant-date",
        status: "accepted",
        scheduledMoment: "ce soir, 20:00",
        note: "Rendez-vous public plus premium pour tester la couche romantique et l'impact social.",
        bridgeToRealLife: "Format propre pour un vrai rendez-vous : lieu public, courte duree, intention claire et sans forcing.",
        createdAt
      }
    ];
    notifications = [
      {
        id: "romantic-mode",
        kind: "social",
        title: "Etat test : vie sociale haute",
        body: "Ce profil sert a valider les dates, les invitations, la compatibilite et les sorties qualitatives.",
        createdAt,
        read: false
      },
      ...runtime.notifications
    ];
    lifeFeed = [
      {
        id: "feed-romantic-start",
        title: "Profil test social premium",
        body: "Le compte demarre avec un bon rythme, une image propre et un date deja valide pour tester la couche relationnelle.",
        createdAt
      },
      ...runtime.lifeFeed
    ];
  }

  return {
    session: { email: "test@mylife.app", provider: "local" as const },
    avatar,
    stats,
    currentLocationSlug: "cafe",
    currentNeighborhoodSlug: "central-district",
    conversations,
    dailyGoals,
    lastRewardAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    notifications,
    advice: buildAdvice(stats),
    relationships,
    invitations,
    datePlans,
    dailyEvent: generateDailyEvent(detectLifePattern(stats)),
    lastKnownRank: getSocialRankLabel(stats.socialRankScore),
    lifeFeed
  };
}

function withActionApplied(state: GameState, action: LifeActionId) {
  let nextStats = applyDecay(state.stats);
  let nextGoals = state.dailyGoals;
  let notifications = [...state.notifications];
  let lifeFeed = [...state.lifeFeed];

  if (action === "healthy-meal") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money - 14,
      hunger: nextStats.hunger + 34,
      hydration: nextStats.hydration + 6,
      health: nextStats.health + 4,
      mood: nextStats.mood + 6,
      discipline: nextStats.discipline + 4,
      weight: nextStats.weight + 0.05,
      lastDecayAt: nowIso(),
      lastMealAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["manger"]);
  }

  if (action === "comfort-meal") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money - 18,
      hunger: nextStats.hunger + 30,
      hydration: nextStats.hydration + 2,
      mood: nextStats.mood + 10,
      stress: nextStats.stress - 4,
      health: nextStats.health - 2,
      weight: nextStats.weight + 0.25,
      lastDecayAt: nowIso(),
      lastMealAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["manger"]);
  }

  if (action === "hydrate") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money - 2,
      hydration: nextStats.hydration + 24,
      health: nextStats.health + 2,
      stress: nextStats.stress - 2,
      lastDecayAt: nowIso()
    });
  }

  if (action === "sleep") {
    nextStats = normalizeStats({
      ...nextStats,
      energy: nextStats.energy + 44,
      stress: nextStats.stress - 12,
      hunger: nextStats.hunger - 8,
      hydration: nextStats.hydration - 4,
      mood: nextStats.mood + 6,
      motivation: nextStats.motivation + 6,
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["hygiene"]);
  }

  if (action === "shower") {
    nextStats = normalizeStats({
      ...nextStats,
      hygiene: nextStats.hygiene + 38,
      mood: nextStats.mood + 7,
      reputation: nextStats.reputation + 2,
      stress: nextStats.stress - 5,
      money: nextStats.money - 3,
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["hygiene"]);
  }

  if (action === "reset") {
    nextStats = normalizeStats({
      ...nextStats,
      hygiene: nextStats.hygiene + 16,
      stress: nextStats.stress - 3,
      mood: nextStats.mood + 3,
      lastDecayAt: nowIso()
    });
  }

  if (action === "work-shift") {
    const job = getStarterJob(state.avatar?.starterJob ?? jobs[0].slug);
    const rewardCoins = applyMomentumGain(job.rewardCoins, nextStats);
    const disciplineReward = applyMomentumGain(job.disciplineReward, nextStats);
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money + rewardCoins,
      energy: nextStats.energy - job.energyCost,
      hunger: nextStats.hunger - job.hungerCost,
      stress: nextStats.stress + job.stressCost,
      discipline: nextStats.discipline + disciplineReward,
      reputation: nextStats.reputation + job.reputationReward,
      motivation: nextStats.motivation + 3,
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["travailler", "produire"]);
    notifications = appendNotification(notifications, {
      id: `work-${Date.now()}`,
      kind: "work",
      title: "Shift termine",
      body: `Tu as termine une session de ${job.name.toLowerCase()}. Ton niveau de vie se renforce.`,
      createdAt: nowIso(),
      read: false
    });
  }

  if (action === "focus-task") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money + applyMomentumGain(18, nextStats),
      energy: nextStats.energy - 8,
      stress: nextStats.stress + 4,
      discipline: nextStats.discipline + applyMomentumGain(6, nextStats),
      motivation: nextStats.motivation + 4,
      reputation: nextStats.reputation + 1,
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["travailler", "produire"]);
  }

  if (action === "walk") {
    nextStats = applyActivityToStats(nextStats, "walk");
    nextGoals = updateGoal(nextGoals, ["bouger"]);
  }

  if (action === "gym") {
    nextStats = applyActivityToStats(nextStats, "gym-session");
    nextGoals = updateGoal(nextGoals, ["bouger"]);
  }

  if (action === "cafe-chat") {
    nextStats = applyActivityToStats(nextStats, "coffee-meetup");
    nextGoals = updateGoal(nextGoals, ["parler"]);
  }

  if (action === "restaurant-outing") {
    nextStats = applyActivityToStats(nextStats, "restaurant-date");
    nextGoals = updateGoal(nextGoals, ["parler"]);
  }

  if (action === "cinema-date") {
    nextStats = applyActivityToStats(nextStats, "cinema-night");
    nextGoals = updateGoal(nextGoals, ["parler"]);
  }

  if (action === "rest-home") {
    nextStats = normalizeStats({
      ...nextStats,
      energy: nextStats.energy + 16,
      mood: nextStats.mood + 5,
      stress: nextStats.stress - 8,
      motivation: nextStats.motivation + 4,
      lastDecayAt: nowIso()
    });
  }

  nextStats = normalizeStats(nextStats);
  notifications = buildAutomaticNotifications(nextStats, notifications);
  lifeFeed = appendFeed(lifeFeed, createFeedFromAction(action));

  return {
    stats: nextStats,
    dailyGoals: nextGoals,
    notifications,
    advice: buildAdvice(nextStats),
    lifeFeed
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState(),
      signIn: async (email: string, password?: string) => {
        const cleanedEmail = email.trim().toLowerCase();
        if (!cleanedEmail) {
          return { ok: false, error: "Adresse e-mail requise." };
        }

        if (isSupabaseConfigured && supabase && password) {
          const { error } = await supabase.auth.signInWithPassword({ email: cleanedEmail, password });
          if (error) {
            return { ok: false, error: error.message };
          }

          set({ session: { email: cleanedEmail, provider: "supabase" } });
          return { ok: true };
        }

        set({ session: { email: cleanedEmail, provider: "local" } });
        return { ok: true };
      },
      loadTestAccount: (preset = "balanced") => set((state) => ({ ...state, ...createTestAccountState(preset) })),
      signOut: () => set({ ...initialState(), hasHydrated: true }),
      completeAvatar: (avatar) => {
        const stats = createStatsFromAvatar(avatar);
        const createdAt = nowIso();
        set({
          avatar,
          stats,
          advice: buildAdvice(stats),
          invitations: [
            {
              id: "invite-ava-start",
              residentId: "ava",
              residentName: "Ava",
              activitySlug: "coffee-meetup",
              status: "pending",
              createdAt
            }
          ],
          notifications: appendNotification(createInitialRuntime().notifications, {
            id: "onboarding-finished",
            kind: "social",
            title: "Ava t'attend au Social Cafe",
            body: "Premier bon move : accepte l'invitation et lance une interaction simple.",
            createdAt,
            read: false
          }),
          lifeFeed: appendFeed(createInitialRuntime().lifeFeed, {
            id: "feed-avatar-ready",
            title: "Avatar finalise",
            body: "Tu entres dans le quartier avec une vraie identite, un style et un profil comportemental clair.",
            createdAt
          })
        });
      },
      editAvatar: (avatar) => set({ avatar }),
      bootstrap: () =>
        set((state) => {
          const stats = applyDecay(state.stats);
          const notifications = buildAutomaticNotifications(stats, state.notifications);
          let invitations = state.invitations;
          let datePlans = state.datePlans;
          let { dailyEvent } = state;

          const today = new Date().toDateString();

          // Reset daily goals at midnight
          const lastGoalReset = (state as GameState & { lastDailyGoalResetAt?: string | null }).lastDailyGoalResetAt;
          const goalsNeedReset = !lastGoalReset || new Date(lastGoalReset).toDateString() !== today;
          const dailyGoals = goalsNeedReset ? seededDailyGoals() : state.dailyGoals;

          // Streak warning: lastRewardAt was yesterday → still ok; was before yesterday → streak will reset on next claim
          if (state.lastRewardAt) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toDateString();
            const lastRewardDay = new Date(state.lastRewardAt).toDateString();
            const streakAtRisk =
              lastRewardDay === yesterday && state.stats.streak >= 3 && new Date(state.lastRewardAt).toDateString() !== today;
            const streakAlreadyBroken = lastRewardDay === twoDaysAgo || (lastRewardDay !== yesterday && lastRewardDay !== today);

            if (streakAtRisk && !notifications.some((n) => n.id.startsWith("streak-warning-"))) {
              notifications.unshift({
                id: `streak-warning-${today}`,
                kind: "reward",
                title: `Serie de ${state.stats.streak} jours en danger`,
                body: "Tu n'as pas encore recupere la reward aujourd'hui. Claim-la avant minuit pour garder ta serie.",
                createdAt: nowIso(),
                read: false
              });
            }
            if (streakAlreadyBroken && state.stats.streak >= 3 && !notifications.some((n) => n.id.startsWith("streak-lost-"))) {
              notifications.unshift({
                id: `streak-lost-${today}`,
                kind: "tip",
                title: `Serie perdue (etait ${state.stats.streak} jours)`,
                body: "Un jour manque repart la compteur a zero. Reprends des aujourd'hui — la constance compte plus que la perfection.",
                createdAt: nowIso(),
                read: false
              });
            }
          }

          // Generate daily event if none today
          const hasEventToday = dailyEvent && new Date(dailyEvent.createdAt).toDateString() === today;
          if (!hasEventToday) {
            dailyEvent = generateDailyEvent(detectLifePattern(stats));
            notifications.unshift({
              id: `notif-event-${Date.now()}`,
              kind: "tip",
              title: `Evenement du jour : ${dailyEvent.title}`,
              body: "Un evenement t'attend sur l'ecran principal.",
              createdAt: nowIso(),
              read: false
            });
          }

          // Rank change detection
          const currentRank = getSocialRankLabel(stats.socialRankScore);
          let lastKnownRank = state.lastKnownRank ?? currentRank;
          if (state.lastKnownRank && state.lastKnownRank !== currentRank) {
            const prevIdx = RANK_ORDER.indexOf(state.lastKnownRank);
            const currIdx = RANK_ORDER.indexOf(currentRank);
            const rankUp = currIdx > prevIdx;
            notifications.unshift({
              id: `rank-change-${Date.now()}`,
              kind: "reward",
              title: rankUp ? `Rang atteint : ${currentRank}` : `Rang perdu : retour en ${currentRank}`,
              body: rankUp
                ? `Tu es passe de ${state.lastKnownRank} a ${currentRank}. Les residents le remarqueront.`
                : `Ton rang a baisse. Stabilise tes routines pour remonter.`,
              createdAt: nowIso(),
              read: false
            });
            lastKnownRank = currentRank;
          }

          // Try resident invitation
          const newInvitation = tryGenerateResidentInvitation(stats, state.relationships, invitations);
          if (newInvitation) {
            const resident = starterResidents.find((r) => r.id === newInvitation.residentId);
            const activity = activities.find((a) => a.slug === newInvitation.activitySlug);
            invitations = [newInvitation, ...invitations].slice(0, 20);
            notifications.unshift({
              id: `notif-${newInvitation.id}`,
              kind: "social",
              title: `${newInvitation.residentName} t'invite`,
              body: `${resident?.name ?? newInvitation.residentName} propose ${activity?.name.toLowerCase() ?? newInvitation.activitySlug}. Reponds dans l'onglet Social.`,
              createdAt: nowIso(),
              read: false
            });
          }

          const pendingDate = datePlans.find((item) => item.status === "accepted");
          if (pendingDate) {
            notifications.unshift({
              id: `date-reminder-${Date.now()}`,
              kind: "social",
              title: `Date prevu : ${pendingDate.venueLabel}`,
              body: `${pendingDate.residentName} t'attend pour un moment sobre et public. Si tu n'es pas dans un bon etat, reporte-le proprement.`,
              createdAt: nowIso(),
              read: false
            });
          }

          const momentum = getMomentumState(stats);
          if (momentum.tier === "active" && state.stats.streak < 3 && stats.streak >= 3) {
            notifications.unshift({
              id: `momentum-3-${Date.now()}`,
              kind: "reward",
              title: "Momentum actif",
              body: "Tu viens de passer un cap de regularite. Tes bonnes actions paient un peu plus.",
              createdAt: nowIso(),
              read: false
            });
          }
          if (momentum.tier === "locked-in" && state.stats.streak < 7 && stats.streak >= 7) {
            notifications.unshift({
              id: `momentum-7-${Date.now()}`,
              kind: "reward",
              title: "Momentum verrouille",
              body: "Ton rythme est maintenant visible. Le quartier commence a vraiment te considerer différemment.",
              createdAt: nowIso(),
              read: false
            });
          }

          return {
            stats,
            advice: buildAdvice(stats),
            notifications,
            invitations,
            datePlans,
            dailyEvent,
            lastKnownRank,
            dailyGoals,
            ...(goalsNeedReset ? { lastDailyGoalResetAt: today } : {})
          };
        }),
      performAction: (action) => set((state) => withActionApplied(state, action)),
      travelTo: (locationSlug) =>
        set((state) => {
          const location = locations.find((item) => item.slug === locationSlug) ?? locations[0];
          const nextStats = normalizeStats({
            ...state.stats,
            mood: state.stats.mood + Math.max(1, Math.round(location.socialEnergy / 22)),
            sociability: state.stats.sociability + Math.max(1, Math.round(location.socialEnergy / 18)),
            energy: state.stats.energy - 2,
            lastDecayAt: nowIso()
          });

          // Inject resident message in local channel (only if no recent resident message)
          let conversations = ensureLocalConversation(state.conversations, location.slug);
          const visitMessage = buildResidentVisitMessage(location.slug, nextStats);
          if (visitMessage) {
            const localId = `local-${location.slug}`;
            const TWO_HOURS = 2 * 60 * 60 * 1000;
            conversations = conversations.map((conv) => {
              if (conv.id !== localId) return conv;
              const lastResidentMsg = [...conv.messages]
                .reverse()
                .find((m) => m.authorId !== "self" && m.kind === "message");
              const tooRecent = lastResidentMsg
                ? Date.now() - new Date(lastResidentMsg.createdAt).getTime() < TWO_HOURS
                : false;
              if (tooRecent) return conv;
              return {
                ...conv,
                unreadCount: conv.unreadCount + 1,
                messages: [...conv.messages, visitMessage]
              };
            });
          }

          return {
            currentLocationSlug: location.slug,
            currentNeighborhoodSlug: location.neighborhoodSlug,
            conversations,
            stats: nextStats,
            advice: buildAdvice(nextStats),
            notifications: appendNotification(state.notifications, {
              id: `travel-${Date.now()}`,
              kind: "social",
              title: `Tu es maintenant a ${location.name}`,
              body: location.summary,
              createdAt: nowIso(),
              read: false
            }),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-travel-${Date.now()}`,
              title: "Changement de decor",
              body: `Tu as rejoint ${location.name}. Le contexte influence ton humeur, ton image et tes rencontres.`,
              createdAt: nowIso()
            })
          };
        }),
      sendMessage: (conversationId, body) =>
        set((state) => {
          const cleanBody = body.trim();
          if (!cleanBody) {
            return state;
          }

          const createdAt = nowIso();
          const targetConversation = state.conversations.find((conversation) => conversation.id === conversationId);
          const residentId = targetConversation?.peerId ?? null;
          const msgResident = starterResidents.find((r) => r.id === residentId);
          const relationships = residentId
            ? updateRelationshipScore(state.relationships, residentId, 6, state.stats, msgResident?.reputation ?? 60)
            : state.relationships;
          const nextStats = normalizeStats({
            ...state.stats,
            sociability: state.stats.sociability + 6,
            mood: state.stats.mood + 4,
            reputation: state.stats.reputation + 1,
            lastDecayAt: createdAt,
            lastSocialAt: createdAt
          });

          // Réponse résident dans les DM (1 message sur 2, seulement direct)
          const isDirectConv = targetConversation?.kind === "direct";
          const selfMessages = (targetConversation?.messages ?? []).filter((m) => m.authorId === "self").length;
          const reply = isDirectConv && residentId ? buildResidentReply(residentId, selfMessages) : null;

          return {
            conversations: state.conversations.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;
              const msgs = [
                ...conversation.messages,
                {
                  id: `msg-${Date.now()}`,
                  authorId: "self",
                  body: cleanBody,
                  createdAt,
                  read: true,
                  kind: "message" as const
                },
                ...(reply ? [reply] : [])
              ];
              return { ...conversation, unreadCount: reply ? 1 : 0, messages: msgs };
            }),
            relationships,
            stats: nextStats,
            advice: buildAdvice(nextStats),
            dailyGoals: updateGoal(state.dailyGoals, ["parler"]),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-message-${Date.now()}`,
              title: "Interaction envoyee",
              body: "Un message simple entretient mieux le lien que de longues absences.",
              createdAt
            })
          };
        }),
      startDirectConversation: (residentId, residentName) =>
        set((state) => {
          const existing = state.conversations.find((item) => item.kind === "direct" && item.peerId === residentId);
          if (existing) {
            return state;
          }

          const createdAt = nowIso();
          return {
            conversations: [
              {
                id: `dm-${residentId}`,
                peerId: residentId,
                title: residentName,
                subtitle: "conversation privee",
                kind: "direct",
                locationSlug: null,
                unreadCount: 1,
                messages: [
                  {
                    id: `seed-${residentId}`,
                    authorId: residentId,
                    body: `Salut. Je suis ${residentName}. Si tu veux tenir ici, garde ton energie propre et reste constant.`,
                    createdAt,
                    read: false,
                    kind: "message"
                  }
                ]
              },
              ...state.conversations
            ],
            relationships: updateRelationshipScore(state.relationships, residentId, 4, state.stats, starterResidents.find((r) => r.id === residentId)?.reputation ?? 60),
            notifications: appendNotification(state.notifications, {
              id: `dm-${residentId}-${Date.now()}`,
              kind: "social",
              title: `${residentName} a ouvert un echange`,
              body: "Tu peux repondre maintenant ou garder ce lien chaud pour plus tard.",
              createdAt,
              read: false
            })
          };
        }),
      sendInvitation: (residentId, activitySlug) =>
        set((state) => {
          const resident = starterResidents.find((item) => item.id === residentId);
          const activity = activities.find((item) => item.slug === activitySlug);
          if (!resident || !activity) {
            return state;
          }

          const createdAt = nowIso();
          const invitationId = `invite-${residentId}-${Date.now()}`;
          const conversations = ensureLocalConversation(state.conversations, activity.locationSlug);
          return {
            invitations: [
              {
                id: invitationId,
                residentId,
                residentName: resident.name,
                activitySlug,
                status: "pending" as const,
                createdAt
              },
              ...state.invitations
            ].slice(0, 20),
            conversations: conversations.map((conversation) =>
              conversation.peerId === residentId
                ? {
                    ...conversation,
                    messages: [
                      ...conversation.messages,
                      {
                        id: `invite-message-${invitationId}`,
                        authorId: "self",
                        body: `Invitation envoyee : ${activity.name}.`,
                        createdAt,
                        read: true,
                        kind: "invitation"
                      }
                    ]
                  }
                : conversation
            ),
            relationships: updateRelationshipScore(state.relationships, residentId, 8, state.stats, resident.reputation, "ami"),
            notifications: appendNotification(state.notifications, {
              id: `notif-${invitationId}`,
              kind: "social",
              title: `Invitation envoyee a ${resident.name}`,
              body: `${activity.name} peut faire monter humeur, lien et presence sociale.`,
              createdAt,
              read: false
            }),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-${invitationId}`,
              title: "Sortie proposee",
              body: `Tu as propose ${activity.name.toLowerCase()} a ${resident.name}.`,
              createdAt
            })
          };
        }),
      respondInvitation: (invitationId, status) =>
        set((state) => {
          const invitation = state.invitations.find((item) => item.id === invitationId);
          if (!invitation) {
            return state;
          }
          const activity = activities.find((item) => item.slug === invitation.activitySlug);
          if (!activity) {
            return state;
          }

          const createdAt = nowIso();
          const nextStats =
            status === "accepted"
              ? applyActivityToStats(state.stats, activity.slug)
              : normalizeStats({
                  ...state.stats,
                  mood: state.stats.mood - 1,
                  stress: state.stats.stress + 1,
                  lastDecayAt: createdAt
                });

          return {
            invitations: state.invitations.map((item) => (item.id === invitationId ? { ...item, status } : item)),
            relationships: updateRelationshipScore(
              state.relationships,
              invitation.residentId,
              status === "accepted" ? 14 : -2,
              nextStats,
              starterResidents.find((r) => r.id === invitation.residentId)?.reputation ?? 60,
              status === "accepted" ? "ami" : undefined
            ),
            stats: nextStats,
            advice: buildAdvice(nextStats),
            notifications: appendNotification(state.notifications, {
              id: `invitation-${invitationId}-${status}`,
              kind: "social",
              title: status === "accepted" ? "Sortie confirmee" : "Invitation declinee",
              body:
                status === "accepted"
                  ? `${invitation.residentName} est partant pour ${activity.name.toLowerCase()}.`
                  : `${invitation.residentName} n'est pas disponible cette fois.`,
              createdAt,
              read: false
            }),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-${invitationId}-${status}`,
              title: status === "accepted" ? "Sortie validee" : "Invitation fermee",
              body:
                status === "accepted"
                  ? `La sortie ${activity.name.toLowerCase()} a renforce ton lien et ton humeur.`
                  : "Toutes les approches ne convertissent pas. La constance compte plus que la perfection.",
              createdAt
            })
          };
        }),
      proposeDate: (residentId, residentName, venueKind) =>
        set((state) => {
          const relationship = state.relationships.find((item) => item.residentId === residentId);
          const readiness = getDateReadiness(state.stats, relationship, residentId);
          if (!readiness.allowed) {
            return {
              notifications: appendNotification(state.notifications, {
                id: `date-blocked-${Date.now()}`,
                kind: "tip",
                title: "Date pas encore recommande",
                body: readiness.note,
                createdAt: nowIso(),
                read: false
              })
            };
          }

          const resident = starterResidents.find((item) => item.id === residentId);
          if (!resident) {
            return state;
          }

          const scheduledMoment =
            venueKind === "restaurant"
              ? "ce soir, 20:00"
              : venueKind === "cinema"
                ? "ce soir, 19:30"
                : venueKind === "park"
                  ? "demain, 18:30"
                  : "demain, 17:30";

          const plan = buildDatePlan(residentId, residentName, venueKind, scheduledMoment);

          return {
            datePlans: [plan, ...state.datePlans].slice(0, 20),
            conversations: state.conversations.map((conversation) =>
              conversation.peerId === residentId
                ? {
                    ...conversation,
                    messages: [
                      ...conversation.messages,
                      {
                        id: `date-proposal-${plan.id}`,
                        authorId: "self",
                        body: `Proposition de date : ${plan.venueLabel}, ${plan.scheduledMoment}.`,
                        createdAt: nowIso(),
                        read: true,
                        kind: "invitation"
                      }
                    ]
                  }
                : conversation
            ),
            notifications: appendNotification(state.notifications, {
              id: `date-plan-${plan.id}`,
              kind: "social",
              title: `Date propose a ${resident.name}`,
              body: `${plan.venueLabel} · ${plan.scheduledMoment}. ${plan.bridgeToRealLife}`,
              createdAt: nowIso(),
              read: false
            }),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-date-${plan.id}`,
              title: "Date planifie",
              body: `Tu as propose un rendez-vous sobre avec ${resident.name}. Le fond compte plus que l'effet.`,
              createdAt: nowIso()
            })
          };
        }),
      respondDatePlan: (datePlanId, status) =>
        set((state) => {
          const plan = state.datePlans.find((item) => item.id === datePlanId);
          if (!plan) {
            return state;
          }

          return {
            datePlans: state.datePlans.map((item) =>
              item.id === datePlanId ? { ...item, status } : item
            ),
            notifications: appendNotification(state.notifications, {
              id: `date-status-${datePlanId}-${status}`,
              kind: "social",
              title: status === "accepted" ? "Date confirme" : "Date refuse",
              body:
                status === "accepted"
                  ? `${plan.residentName} est partant pour ${plan.venueLabel}.`
                  : `${plan.residentName} n'est pas disponible pour ce rendez-vous.`,
              createdAt: nowIso(),
              read: false
            })
          };
        }),
      completeDatePlan: (datePlanId) =>
        set((state) => {
          const plan = state.datePlans.find((item) => item.id === datePlanId);
          if (!plan) {
            return state;
          }

          const nextStats = applyDatePlanToStats(state.stats, plan);
          const resident = starterResidents.find((item) => item.id === plan.residentId);

          return {
            datePlans: state.datePlans.map((item) =>
              item.id === datePlanId ? { ...item, status: "completed" } : item
            ),
            stats: nextStats,
            advice: buildAdvice(nextStats),
            relationships: updateRelationshipScore(
              state.relationships,
              plan.residentId,
              18,
              nextStats,
              resident?.reputation ?? 60,
              "crush"
            ),
            notifications: appendNotification(state.notifications, {
              id: `date-done-${datePlanId}`,
              kind: "social",
              title: "Date termine",
              body: `${plan.venueLabel} a bien tourne. Le lien gagne en intensite et peut passer dans la vraie vie.`,
              createdAt: nowIso(),
              read: false
            }),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-date-done-${datePlanId}`,
              title: "Moment romantique valide",
              body: `${plan.residentName} te percoit maintenant avec plus de confiance. L'etape suivante peut etre un vrai rendez-vous public.`,
              createdAt: nowIso()
            })
          };
        }),
      performOuting: (config: OutingConfig) =>
        set((state) => {
          const decayed = applyDecay(state.stats);
          const result = resolveOutingResult(config, decayed);
          const nextStats = applyOutingToStats(decayed, result);
          const createdAt = nowIso();
          const qualityMsg =
            result.socialQualityHint === "haute"
              ? "Rencontres de qualite probables — ton mode de vie attire des profils solides."
              : result.socialQualityHint === "basse"
                ? "Sortie risquee. Un niveau de vie instable attire des liens moins solides."
                : "Sortie correcte. Maintiens tes routines pour remonter la qualite sociale.";
          return {
            stats: nextStats,
            advice: buildAdvice(nextStats),
            notifications: appendNotification(state.notifications, {
              id: `outing-${createdAt}`,
              kind: "social",
              title: result.label,
              body: `Humeur +${result.moodGain}, sociabilite +${result.sociabilityGain}, budget -${result.budgetCost}. ${qualityMsg}`,
              createdAt,
              read: false
            }),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-outing-${createdAt}`,
              title: result.label,
              body: `Qualite sociale : ${result.socialQualityHint}. Stress ${result.stressDelta > 0 ? "+" : ""}${result.stressDelta}, discipline ${result.disciplineDelta >= 0 ? "+" : ""}${result.disciplineDelta}.`,
              createdAt
            })
          };
        }),
      resolveDailyEvent: (choice) =>
        set((state) => {
          if (!state.dailyEvent || state.dailyEvent.resolved) return state;
          const effects = choice === "accepted" ? state.dailyEvent.effects : state.dailyEvent.skipEffects;
          const nextStats = applyEventEffects(state.stats, effects);
          const createdAt = nowIso();
          return {
            dailyEvent: { ...state.dailyEvent, resolved: true, choice },
            stats: nextStats,
            advice: buildAdvice(nextStats),
            lifeFeed: appendFeed(state.lifeFeed, {
              id: `feed-event-${Date.now()}`,
              title: state.dailyEvent.title,
              body: choice === "accepted"
                ? `Tu as agi : ${state.dailyEvent.actionLabel}.`
                : `Tu as laisse passer cet evenement.`,
              createdAt
            })
          };
        }),
      claimDailyReward: () =>
        set((state) => {
          const today = new Date().toDateString();
          if (state.lastRewardAt && new Date(state.lastRewardAt).toDateString() === today) {
            return state;
          }

          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
          const streak =
            state.lastRewardAt && new Date(state.lastRewardAt).toDateString() === yesterday ? state.stats.streak + 1 : 1;
          const rewardCoins = applyMomentumGain(32, state.stats);
          let nextStats = normalizeStats({
            ...state.stats,
            money: state.stats.money + rewardCoins,
            mood: state.stats.mood + 8,
            motivation: state.stats.motivation + 6,
            streak,
            lastDecayAt: nowIso()
          });

          const createdAt = nowIso();
          let notifications = appendNotification(state.notifications, {
            id: `daily-${Date.now()}`,
            kind: "reward",
            title: "Reward quotidienne recuperee",
            body: `Tu prends ${rewardCoins} credits et tu prolonges ta serie a ${streak} jour(s).`,
            createdAt,
            read: false
          });
          let lifeFeed = state.lifeFeed;

          // Streak milestone bonus
          const milestone = checkStreakMilestone(streak);
          if (milestone) {
            nextStats = normalizeStats({
              ...nextStats,
              money: nextStats.money + (milestone.effects.money ?? 0),
              mood: nextStats.mood + (milestone.effects.mood ?? 0),
              discipline: nextStats.discipline + (milestone.effects.discipline ?? 0),
              motivation: nextStats.motivation + (milestone.effects.motivation ?? 0),
              reputation: nextStats.reputation + (milestone.effects.reputation ?? 0)
            });
            notifications = appendNotification(notifications, {
              id: `streak-${streak}-${Date.now()}`,
              kind: "reward",
              title: `Palier atteint : Jour ${milestone.day} — ${milestone.label}`,
              body: milestone.message,
              createdAt,
              read: false
            });
            lifeFeed = appendFeed(lifeFeed, {
              id: `feed-streak-${streak}`,
              title: `Serie ${streak} jours : ${milestone.label}`,
              body: milestone.message,
              createdAt
            });
          }

          return {
            lastRewardAt: nowIso(),
            stats: nextStats,
            advice: buildAdvice(nextStats),
            notifications,
            lifeFeed
          };
        }),
      markNotificationRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((item) => ({ ...item, read: true }))
        })),
      resetAll: () => set({ ...initialState(), hasHydrated: true })
    }),
    {
      name: "mylife-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        avatar: state.avatar,
        stats: state.stats,
        currentLocationSlug: state.currentLocationSlug,
        currentNeighborhoodSlug: state.currentNeighborhoodSlug,
        conversations: state.conversations,
        dailyGoals: state.dailyGoals,
        lastRewardAt: state.lastRewardAt,
        notifications: state.notifications,
        advice: state.advice,
        relationships: state.relationships,
        invitations: state.invitations,
        datePlans: state.datePlans,
        dailyEvent: state.dailyEvent,
        lastKnownRank: state.lastKnownRank,
        lastDailyGoalResetAt: (state as GameState & { lastDailyGoalResetAt?: string | null }).lastDailyGoalResetAt,
        lifeFeed: state.lifeFeed
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          useGameStore.setState({ hasHydrated: true });
          return;
        }

        const stats = applyDecay(state.stats);
        useGameStore.setState({
          hasHydrated: true,
          stats,
          advice: buildAdvice(stats),
          notifications: buildAutomaticNotifications(stats, state.notifications)
        });
      }
    }
  )
);

export const residents = starterResidents;
export const worldLocations = locations;
