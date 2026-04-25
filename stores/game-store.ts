import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { buildDirectBotReply, buildNpcLoungeMessage, buildRoomBotReplies } from "@/lib/bot-brain";
import { applyActionToMissions, claimMissionReward } from "@/lib/missions";
import { seedNpcs, tickAllNpcs } from "@/lib/npc-brain";
import { generateNpcEvents } from "@/lib/npc-ai";
import { sendLocalNotification } from "@/lib/notifications";
import { BOOSTS, COSMETICS, getBoostMultiplier } from "@/lib/premium";
import { getActionTimeScore, getTimeContext } from "@/lib/time-context";
import {
  pullAvatarFromSupabase,
  syncAvatarToSupabase,
  syncPremiumToSupabase,
  syncProgressionToSupabase,
  syncStatsToSupabase,
  logSocialTransferToSupabase,
  syncStudyProgressToSupabase
} from "@/lib/supabase-sync";
import type { BoostItem, CosmeticItem, MoneyTransfer, NpcState, PremiumTier, Room, RoomInvite, RoomKind, RoomMessage, SecretRoom, SecretMessage, StudyProgress, StudySessionInput } from "@/lib/types";
import { computeWealthScore, getHousingTier, getMaxAffordableHousing, type HousingTierId } from "@/lib/housing";
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
  AvatarStats,
  Conversation,
  DatePlan,
  DateVenueKind,
  DailyEvent,
  InvitationRecord,
  LifeActionId,
  NotificationItem,
  OutingConfig,
  RelationshipRecord,
  SocialRank,
  UserSession
} from "@/lib/types";

type TestAccountPreset = "balanced" | "burnout" | "romantic" | "live";

const DEFAULT_ROOMS: Array<Omit<Room, "createdAt">> = [
  {
    id: "room-lounge-global",
    name: "Lounge - La ville",
    kind: "public" as RoomKind,
    code: "LOUNGE",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "cafe",
    memberCount: 6,
    maxMembers: 100,
    description: "Chat public de la ville - tout le monde peut écrire ici.",
    isActive: true
  },
  {
    id: "room-home-suite",
    name: "Home Suite",
    kind: "private" as RoomKind,
    code: "HOME",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "home",
    memberCount: 1,
    maxMembers: 8,
    description: "Ta suite personnelle. Repos, calme et conversations privées.",
    isActive: true
  },
  {
    id: "room-test-live",
    name: "Room Live - Ava, Noa & Leila",
    kind: "public" as RoomKind,
    code: "LIVE",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "cafe",
    memberCount: 3,
    maxMembers: 20,
    description: "Room test avec 3 résidents autonomes. Rejoins et discute en direct.",
    isActive: true
  },
  {
    id: "room-pulse-gym",
    name: "Pulse Gym",
    kind: "public" as RoomKind,
    code: "GYM",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "gym",
    memberCount: 2,
    maxMembers: 20,
    description: "Salle de sport live pour discuter entraînement, énergie et défis.",
    isActive: true
  },
  {
    id: "room-luma-cinema",
    name: "Luma Cinema",
    kind: "public" as RoomKind,
    code: "CINE",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "cinema",
    memberCount: 2,
    maxMembers: 20,
    description: "Salle cinéma pour sorties, films et rencontres tranquilles.",
    isActive: true
  },
  {
    id: "room-focus-office",
    name: "Focus Office",
    kind: "public" as RoomKind,
    code: "WORK",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "office",
    memberCount: 2,
    maxMembers: 16,
    description: "Espace business, réseau, travail et progression.",
    isActive: true
  },
  {
    id: "room-riverside-park",
    name: "Riverside Park",
    kind: "public" as RoomKind,
    code: "PARK",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "park",
    memberCount: 2,
    maxMembers: 20,
    description: "Parc live pour marcher, respirer et rencontrer des gens.",
    isActive: true
  },
  {
    id: "room-fresh-market",
    name: "Fresh Market",
    kind: "public" as RoomKind,
    code: "SHOP",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "market",
    memberCount: 2,
    maxMembers: 18,
    description: "Marché social pour courses, échanges et petites discussions.",
    isActive: true
  },
  {
    id: "room-dinner-social",
    name: "Dinner Social",
    kind: "public" as RoomKind,
    code: "FOOD",
    ownerId: "system",
    ownerName: "Système",
    locationSlug: "restaurant",
    memberCount: 2,
    maxMembers: 18,
    description: "Restaurant live pour dates, sorties et discussions calmes.",
    isActive: true
  }
];

function createDefaultRoom(room: Omit<Room, "createdAt">): Room {
  return { ...room, createdAt: new Date().toISOString() } as Room;
}

function defaultRoomByCode(code: string): Room | undefined {
  const normalized = code.toUpperCase();
  const room = DEFAULT_ROOMS.find((item) => item.code === normalized);
  return room ? createDefaultRoom(room) : undefined;
}

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
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  loadTestAccount: (preset?: TestAccountPreset) => void;
  signOut: () => void;
  // Méthodes internes utilisées par useAuthListener
  _setSupabaseSession: (email: string, userId: string) => void;
  _hydrateFromSupabase: (avatar: AvatarProfile, stats: Partial<AvatarStats> | undefined, avatarId: string) => void;
  completeAvatar: (avatar: AvatarProfile) => void;
  editAvatar: (avatar: AvatarProfile) => void;
  bootstrap: () => void;
  performAction: (action: LifeActionId) => void;
  travelTo: (locationSlug: string, options?: { cost?: number; modeLabel?: string; energyCost?: number }) => void;
  sendMessage: (conversationId: string, body: string) => void;
  startDirectConversation: (residentId: string, residentName: string) => void;
  likeResident: (residentId: string) => void;
  sendInvitation: (residentId: string, activitySlug: string) => void;
  respondInvitation: (invitationId: string, status: "accepted" | "declined") => void;
  proposeDate: (residentId: string, residentName: string, venueKind: DateVenueKind) => void;
  respondDatePlan: (datePlanId: string, status: "accepted" | "declined") => void;
  completeDatePlan: (datePlanId: string) => void;
  performOuting: (config: OutingConfig) => void;
  resolveDailyEvent: (choice: "accepted" | "skipped") => void;
  tutorialDone: boolean;
  completeTutorial: () => void;
  claimDailyReward: () => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  markConversationRead: (conversationId: string) => void;
  resetAll: () => void;
  // Premium
  isPremium: boolean;
  premiumTier: PremiumTier | null;
  premiumExpiresAt: string | null;
  activeBoosts: BoostItem[];
  equippedCosmetics: string[];
  activatePremium: (tier: PremiumTier) => void;
  deactivatePremium: () => void;
  buyBoost: (boostId: string) => { ok: boolean; error?: string };
  buyCosmetic: (cosmeticId: string) => { ok: boolean; error?: string };
  // Travail — sessions + progression
  workSession: import("@/lib/types").WorkSession;
  jobXp: number;
  jobLevel: number;
  shiftHistory: import("@/lib/types").ShiftRecord[];
  playerXp: number;
  playerLevel: number;
  // Missions
  missionProgresses: import("@/lib/missions").MissionProgress[];
  claimMission: (missionId: string) => void;
  // Progression talents
  unlockedTalents: string[];
  unlockTalent: (talentId: string) => void;
  startWorkShift: (jobSlug: string) => void;
  completeWorkShift: () => void;
  cancelWorkShift: () => void;
  // Etudes
  studyProgress: StudyProgress[];
  recordStudySession: (input: StudySessionInput) => StudyProgress;
  // Economie sociale
  moneyTransfers: MoneyTransfer[];
  sendMoneyToResident: (residentId: string, residentName: string, amount: number) => { ok: boolean; error?: string };
  // Supabase
  supabaseAvatarId: string | null;
  syncToSupabase: () => Promise<void>;
  // Logement
  housingTier: HousingTierId;
  housingLastPaidAt: string | null;
  upgradeHousing: (tierId: HousingTierId) => { ok: boolean; error?: string };
  checkHousingRent: () => void;
  wealthScore: number;
  // Monde vivant — NPCs
  npcs: NpcState[];
  tickNpcs: () => void;
  // Rooms live
  rooms: Room[];
  roomMessages: Record<string, RoomMessage[]>;  // roomId → messages locaux
  joinedRooms: string[];                         // IDs rooms rejointes
  roomInvites: RoomInvite[];
  createRoom: (name: string, description: string, kind: RoomKind) => Room;
  joinRoom: (code: string) => Room | null;
  leaveRoom: (roomId: string) => void;
  sendRoomMessage: (roomId: string, body: string) => void;
  createPrivateRoom: (name: string) => Room;
  inviteNpcToRoom: (roomId: string, residentId: string) => void;
  respondRoomInvite: (inviteId: string, status: "accepted" | "declined") => void;
  // Secret Rooms — éphémères, max 4, messages 2h TTL
  secretRooms: SecretRoom[];
  secretMessages: Record<string, SecretMessage[]>; // roomId → messages
  createSecretRoom: (name: string) => SecretRoom;
  joinSecretRoom: (code: string) => SecretRoom | null;
  leaveSecretRoom: (roomId: string) => void;
  sendSecretMessage: (roomId: string, body: string) => void;
  purgeExpiredSecretRooms: () => void;
};

function initialState() {
  const runtime = createInitialRuntime();
  return {
    hasHydrated: false,
    tutorialDone: false,
    session: null as UserSession | null,
    npcs: seedNpcs() as NpcState[],
    rooms: DEFAULT_ROOMS.map(createDefaultRoom) as Room[],
    isPremium: false,
    premiumTier: null as PremiumTier | null,
    premiumExpiresAt: null as string | null,
    activeBoosts: [] as BoostItem[],
    equippedCosmetics: [] as string[],
    workSession: {
      phase: "idle" as import("@/lib/types").WorkSessionPhase,
      startedAt: null,
      durationSec: 5,
      jobSlug: "office-assistant",
      earnedCoins: 0,
      earnedXp: 0,
      earnedDiscipline: 0,
      earnedReputation: 0,
    } as import("@/lib/types").WorkSession,
    jobXp: 0,
    jobLevel: 1,
    shiftHistory: [] as import("@/lib/types").ShiftRecord[],
    playerXp: 0,
    playerLevel: 1,
    missionProgresses: [] as import("@/lib/missions").MissionProgress[],
    unlockedTalents: [] as string[],
    studyProgress: [] as StudyProgress[],
    moneyTransfers: [] as MoneyTransfer[],
    housingTier: "squat" as HousingTierId,
    housingLastPaidAt: null as string | null,
    wealthScore: 0,
    roomMessages: {} as Record<string, RoomMessage[]>,
    joinedRooms: ["room-home-suite", "room-test-live", "room-lounge-global"] as string[],
    roomInvites: [] as RoomInvite[],
    secretRooms: [] as SecretRoom[],
    secretMessages: {} as Record<string, SecretMessage[]>,
    supabaseAvatarId: null as string | null,
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

  let relationships: RelationshipRecord[] = runtime.relationships.map((item) => {
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

  let conversations = [
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

  if (preset === "live") {
    stats = normalizeStats({
      ...stats,
      hunger: 96,
      hydration: 96,
      energy: 97,
      hygiene: 98,
      mood: 96,
      sociability: 98,
      health: 96,
      fitness: 92,
      stress: 8,
      money: 2500,
      socialRankScore: 92,
      reputation: 94,
      discipline: 95,
      motivation: 96,
      streak: 30,
      lastMealAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      lastWorkoutAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      lastSocialAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      lastDecayAt: createdAt
    });

    relationships = relationships.map((item) => {
      const resident = starterResidents.find((r) => r.id === item.residentId);
      return {
        ...item,
        status: item.residentId === "noa" ? "relation" as const : "cercle-proche" as const,
        score: item.residentId === "noa" ? 92 : resident?.socialRank === "influent" ? 86 : 78,
        quality: "inspirante" as const,
        influence: "positive" as const,
        isFollowing: true,
        lastInteractionAt: createdAt
      };
    });

    conversations = [
      ...starterResidents.map((resident) => ({
        id: `dm-${resident.id}-live`,
        peerId: resident.id,
        title: resident.name,
        subtitle: "conversation test live",
        kind: "direct" as const,
        locationSlug: null,
        unreadCount: 1,
        messages: [
          {
            id: `live-${resident.id}-1`,
            authorId: resident.id,
            body: `Mode test live actif. ${resident.name} est disponible pour tester les relations, messages et invitations.`,
            createdAt,
            read: false,
            kind: "message" as const
          },
          {
            id: `live-${resident.id}-2`,
            authorId: "self",
            body: "Je teste le parcours complet.",
            createdAt,
            read: true,
            kind: "message" as const
          }
        ]
      })),
      ...runtime.conversations
    ];

    invitations = starterResidents.slice(0, 4).map((resident, index) => ({
      id: `live-invite-${resident.id}`,
      residentId: resident.id,
      residentName: resident.name,
      activitySlug: ["coffee-meetup", "group-outing", "evening-walk", "gym-session"][index] ?? "coffee-meetup",
      status: "pending" as const,
      createdAt
    }));

    datePlans = [
      {
        id: "live-date-noa-restaurant",
        residentId: "noa",
        residentName: "Noa",
        venueKind: "restaurant",
        venueLabel: "Restaurant",
        activitySlug: "restaurant-date",
        status: "accepted",
        scheduledMoment: "ce soir, 20:00",
        note: "Date test premium deja accepte pour valider tout le flow.",
        bridgeToRealLife: "Lieu public, intention claire, duree courte.",
        createdAt
      },
      {
        id: "live-date-noa-cinema",
        residentId: "noa",
        residentName: "Noa",
        venueKind: "cinema",
        venueLabel: "Cinema public",
        activitySlug: "cinema-night",
        status: "proposed",
        scheduledMoment: "demain, 19:30",
        note: "Deuxieme date propose pour tester les statuts.",
        bridgeToRealLife: "Format calme et public.",
        createdAt
      }
    ];

    dailyGoals = runtime.dailyGoals.map((goal) => ({ ...goal, completed: true }));
    notifications = [
      {
        id: "live-mode-ready",
        kind: "reward" as const,
        title: "Mode test live active",
        body: "Toutes les capacites de test sont chargees : premium, social, dates, rooms, economie, travail, etudes.",
        createdAt,
        read: false
      },
      {
        id: "live-premium-ready",
        kind: "reward" as const,
        title: "Premium test actif",
        body: "Boosts, cosmetiques et features premium sont disponibles pour validation.",
        createdAt,
        read: false
      },
      ...runtime.notifications
    ];
    lifeFeed = [
      {
        id: "feed-live-mode",
        title: "Compte test complet charge",
        body: "Tu peux maintenant parcourir tous les ecrans avec des donnees riches et des droits debloques.",
        createdAt
      },
      ...runtime.lifeFeed
    ];
  }

  const livePremiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const liveStudyProgress: StudyProgress[] = [
    { moduleId: "dev-web", title: "Developpement Web", sessionsCompleted: 9, level: 3, xp: 315, progressPct: 100, updatedAt: createdAt, completedAt: createdAt },
    { moduleId: "finance-perso", title: "Finance Personnelle", sessionsCompleted: 5, level: 2, xp: 150, progressPct: 83, updatedAt: createdAt, completedAt: null },
    { moduleId: "communication", title: "Communication & Charisme", sessionsCompleted: 4, level: 2, xp: 112, progressPct: 67, updatedAt: createdAt, completedAt: null },
    { moduleId: "fitness-coach", title: "Coach Fitness", sessionsCompleted: 6, level: 3, xp: 180, progressPct: 100, updatedAt: createdAt, completedAt: createdAt }
  ];

  return {
    session: {
      email: preset === "live"
        ? "test-live@mylife.app"
        : preset === "balanced"
          ? "simple@mylife.app"
          : `test-${preset}@mylife.app`,
      provider: "local" as const
    },
    avatar,
    stats,
    currentLocationSlug: preset === "live" ? "cinema" : "cafe",
    currentNeighborhoodSlug: preset === "live" ? "studio-heights" : "central-district",
    conversations,
    dailyGoals,
    lastRewardAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    notifications,
    advice: buildAdvice(stats),
    relationships,
    invitations,
    datePlans,
    studyProgress: preset === "live" ? liveStudyProgress : [],
    dailyEvent: generateDailyEvent(detectLifePattern(stats)),
    lastKnownRank: getSocialRankLabel(stats.socialRankScore),
    lifeFeed,
    ...(preset === "live"
      ? {
          isPremium: true,
          premiumTier: "yearly" as const,
          premiumExpiresAt: livePremiumExpiresAt,
          activeBoosts: BOOSTS.map((boost) => ({ ...boost, activeUntil: livePremiumExpiresAt })),
          equippedCosmetics: COSMETICS.map((cosmetic) => cosmetic.id),
          jobXp: 85,
          jobLevel: 8,
          shiftHistory: [
            { id: "live-shift-support", jobSlug: "support-tech", jobName: "Support tech", earnedCoins: 112, earnedXp: 24, completedAt: createdAt },
            { id: "live-shift-creator", jobSlug: "creator-studio", jobName: "Creator studio", earnedCoins: 104, earnedXp: 22, completedAt: createdAt }
          ],
          moneyTransfers: [
            { id: "live-transfer-ava", kind: "sent" as const, residentId: "ava", residentName: "Ava", amount: -50, description: "Test transfert social", createdAt },
            { id: "live-reward", kind: "received" as const, residentId: null, residentName: null, amount: 500, description: "Bonus mode test live", createdAt },
            { id: "live-boost", kind: "boost" as const, residentId: null, residentName: null, amount: -15, description: "Boost test actif", createdAt }
          ] as MoneyTransfer[],
          rooms: [
            {
              id: "room-test-live",
              name: "Room Live - Ava, Noa & Leila",
              kind: "public" as RoomKind,
              code: "LIVE",
              ownerId: "system",
              ownerName: "Systeme",
              locationSlug: "cafe",
              memberCount: 3,
              maxMembers: 20,
              description: "Room test avec 3 residents autonomes.",
              createdAt,
              isActive: true
            },
            {
              id: "room-live-premium",
              name: "Premium Test Lounge",
              kind: "event" as RoomKind,
              code: "VIP777",
              ownerId: "test-live@mylife.app",
              ownerName: avatar.displayName,
              locationSlug: "restaurant",
              memberCount: 8,
              maxMembers: 20,
              description: "Room evenement pour tester les salons premium et la presence.",
              createdAt,
              isActive: true
            }
          ] as Room[],
          secretRooms: [
            {
              id: "secret-live",
              name: "Secret Test",
              code: "SECRET",
              ownerId: "test-live@mylife.app",
              ownerName: avatar.displayName,
              memberIds: ["test-live@mylife.app"],
              maxMembers: 4,
              expiresAt: livePremiumExpiresAt,
              createdAt,
              isActive: true
            }
          ] as SecretRoom[],
          secretMessages: {
            "secret-live": [
              {
                id: "secret-live-msg",
                authorId: "system",
                authorName: "Systeme",
                body: "Room secrete test active. Code : SECRET.",
                createdAt,
                expiresAt: livePremiumExpiresAt
              }
            ]
          }
        }
      : {})
  };
}

function withActionApplied(state: GameState, action: LifeActionId): Partial<GameState> {
  const boostMultiplier = getBoostMultiplier(state.activeBoosts ?? []);
  // Bonus/malus selon l'heure réelle de l'appareil
  const timeCtx = getTimeContext();
  const timeScore = getActionTimeScore(action, timeCtx);
  const timeMult: number = timeScore.multiplier;
  let nextStats = applyDecay(state.stats);
  let nextGoals = state.dailyGoals;
  let notifications = [...state.notifications];
  let lifeFeed = [...state.lifeFeed];

  if (action === "healthy-meal") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money - 14,
      hunger: nextStats.hunger + Math.round(34 * timeMult),
      hydration: nextStats.hydration + Math.round(6 * timeMult),
      health: nextStats.health + Math.round(4 * timeMult),
      mood: nextStats.mood + Math.round(6 * timeMult),
      discipline: nextStats.discipline + Math.round(4 * timeMult),
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
      energy: nextStats.energy + Math.round(44 * timeMult),
      stress: nextStats.stress - Math.round(12 * timeMult),
      hunger: nextStats.hunger - 8,
      hydration: nextStats.hydration - 4,
      mood: nextStats.mood + Math.round(6 * timeMult),
      motivation: nextStats.motivation + Math.round(6 * timeMult),
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
    const rewardCoins = Math.round(applyMomentumGain(job.rewardCoins, nextStats) * boostMultiplier * timeMult);
    const disciplineReward = Math.round(applyMomentumGain(job.disciplineReward, nextStats) * boostMultiplier * timeMult);
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
      money: nextStats.money + Math.round(applyMomentumGain(18, nextStats) * timeMult),
      energy: nextStats.energy - 8,
      stress: nextStats.stress + 4,
      discipline: nextStats.discipline + Math.round(applyMomentumGain(6, nextStats) * timeMult),
      motivation: nextStats.motivation + Math.round(4 * timeMult),
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

  if (action === "meditate") {
    nextStats = normalizeStats({
      ...nextStats,
      stress: nextStats.stress - Math.round(18 * timeMult),
      mood: nextStats.mood + Math.round(10 * timeMult),
      energy: nextStats.energy + Math.round(6 * timeMult),
      discipline: nextStats.discipline + Math.round(applyMomentumGain(5, nextStats) * timeMult),
      motivation: nextStats.motivation + Math.round(8 * timeMult),
      mentalStability: nextStats.stress > 30 ? "fragile" : "stable",
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["méditer", "zen", "repos"]);
  }

  if (action === "home-cooking") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money - 8,
      hunger: nextStats.hunger + Math.round(38 * timeMult),
      hydration: nextStats.hydration + Math.round(8 * timeMult),
      health: nextStats.health + Math.round(6 * timeMult),
      mood: nextStats.mood + Math.round(8 * timeMult),
      discipline: nextStats.discipline + Math.round(applyMomentumGain(6, nextStats) * timeMult),
      weight: nextStats.weight + 0.03,
      lastDecayAt: nowIso(),
      lastMealAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["manger", "cuisiner"]);
  }

  if (action === "read-book") {
    nextStats = normalizeStats({
      ...nextStats,
      stress: nextStats.stress - 10,
      mood: nextStats.mood + 7,
      motivation: nextStats.motivation + applyMomentumGain(10, nextStats),
      discipline: nextStats.discipline + applyMomentumGain(4, nextStats),
      energy: nextStats.energy - 4,
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["lire", "apprendre"]);
  }

  if (action === "shopping") {
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money - 35,
      mood: nextStats.mood + 12,
      hygiene: nextStats.hygiene + 6,
      reputation: nextStats.reputation + 3,
      stress: nextStats.stress + 4,
      energy: nextStats.energy - 6,
      lastDecayAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["shopping", "image"]);
  }

  if (action === "team-sport") {
    nextStats = normalizeStats({
      ...nextStats,
      energy: nextStats.energy - 20,
      fitness: nextStats.fitness + Math.round(applyMomentumGain(10, nextStats) * timeMult),
      sociability: nextStats.sociability + Math.round(12 * timeMult),
      mood: nextStats.mood + Math.round(10 * timeMult),
      stress: nextStats.stress - Math.round(8 * timeMult),
      health: nextStats.health + Math.round(4 * timeMult),
      hunger: nextStats.hunger - 10,
      hydration: nextStats.hydration - 8,
      weight: nextStats.weight - 0.1,
      reputation: nextStats.reputation + 3,
      lastDecayAt: nowIso(),
      lastWorkoutAt: nowIso(),
      lastSocialAt: nowIso()
    });
    nextGoals = updateGoal(nextGoals, ["bouger", "sport", "parler"]);
  }

  if (action === "nap") {
    nextStats = normalizeStats({
      ...nextStats,
      energy: nextStats.energy + 22,
      stress: nextStats.stress - 8,
      mood: nextStats.mood + 4,
      lastDecayAt: nowIso()
    });
  }

  nextStats = normalizeStats(nextStats);
  notifications = buildAutomaticNotifications(nextStats, notifications);
  lifeFeed = appendFeed(lifeFeed, createFeedFromAction(action));

  // XP joueur par action
  const XP_TABLE: Partial<Record<LifeActionId, number>> = {
    "work-shift": 30, "team-sport": 25, "gym": 25, "walk": 20,
    "read-book": 15, "meditate": 12, "healthy-meal": 8, "home-cooking": 10,
    "cafe-chat": 8, "shower": 5, "sleep": 5, "nap": 3, "shopping": 6,
  };
  const rawXp = Math.round((XP_TABLE[action] ?? 5) * boostMultiplier * timeMult);
  const newPlayerXp = (state.playerXp ?? 0) + rawXp;
  const XP_PER_LEVEL = 200;
  const newPlayerLevel = Math.max(1, Math.floor(newPlayerXp / XP_PER_LEVEL) + 1);

  // Missions progress
  const { updatedProgresses } = applyActionToMissions(
    state.missionProgresses ?? [],
    action,
    newPlayerLevel
  );

  return {
    stats: nextStats,
    dailyGoals: nextGoals,
    notifications,
    advice: buildAdvice(nextStats),
    lifeFeed,
    playerXp: newPlayerXp,
    playerLevel: newPlayerLevel,
    missionProgresses: updatedProgresses,
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
          const { error, data } = await supabase.auth.signInWithPassword({ email: cleanedEmail, password });
          if (error) {
            return { ok: false, error: error.message };
          }

          set({ session: { email: cleanedEmail, provider: "supabase" } });

          // Restaurer l'avatar depuis Supabase si existant
          const userId = data.user?.id;
          if (userId) {
            const pulled = await pullAvatarFromSupabase(userId);
            if (pulled.ok && pulled.avatar && pulled.avatarId) {
              const currentStats = get().stats;
              const mergedStats = pulled.stats ? { ...currentStats, ...pulled.stats } : currentStats;
              set({
                avatar: pulled.avatar as AvatarProfile,
                stats: mergedStats,
                supabaseAvatarId: pulled.avatarId
              });
            }
          }
          return { ok: true };
        }

        set({ session: { email: cleanedEmail, provider: "local" } });
        return { ok: true };
      },
      signUp: async (email: string, password: string) => {
        const cleanedEmail = email.trim().toLowerCase();
        if (!cleanedEmail || !password) {
          return { ok: false, error: "Email et mot de passe requis." };
        }
        if (password.length < 6) {
          return { ok: false, error: "Mot de passe trop court (6 caractères min)." };
        }
        if (!isSupabaseConfigured || !supabase) {
          // Mode local : créer session locale
          set({ session: { email: cleanedEmail, provider: "local" } });
          return { ok: true };
        }
        const { error } = await supabase.auth.signUp({ email: cleanedEmail, password });
        if (error) return { ok: false, error: error.message };
        set({ session: { email: cleanedEmail, provider: "supabase" } });
        return { ok: true };
      },
      resetPassword: async (email: string) => {
        const cleanedEmail = email.trim().toLowerCase();
        if (!cleanedEmail) return { ok: false, error: "Email requis." };
        if (!isSupabaseConfigured || !supabase) {
          return { ok: false, error: "Supabase non configuré. Mode local uniquement." };
        }
        const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
          redirectTo: "mylife://reset-password"
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
      loadTestAccount: (preset = "balanced") => set((state) => ({ ...state, ...createTestAccountState(preset) })),
      signOut: () => {
        void AsyncStorage.removeItem("mylife-storage");
        if (isSupabaseConfigured && supabase) void supabase.auth.signOut();
        set({ ...initialState(), hasHydrated: true });
      },

      // ── Méthodes internes — utilisées par useAuthListener ─────────────────
      _setSupabaseSession: (email: string, _userId: string) => {
        set({ session: { email, provider: "supabase" } });
      },
      _hydrateFromSupabase: (
        avatar: AvatarProfile,
        stats: Partial<AvatarStats> | undefined,
        avatarId: string
      ) => {
        const currentStats = get().stats;
        const mergedStats = stats ? { ...currentStats, ...stats } : currentStats;
        set({ avatar, stats: mergedStats, supabaseAvatarId: avatarId });
      },
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
        // Sync avatar vers Supabase immédiatement après création
        void get().syncToSupabase();
      },
      editAvatar: (avatar) => {
        set({ avatar });
        // Sync les changements de profil
        void get().syncToSupabase();
      },
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

          // ── Pénalités tâches non effectuées ──────────────────────────────
          let penaltyStats = { ...stats };
          let penaltyNotif: typeof notifications = notifications;
          const penaltyNow = Date.now();

          // Pas mangé depuis > 6h → perd argent (urgence alimentaire)
          const hoursSinceEat = stats.lastMealAt
            ? (penaltyNow - new Date(stats.lastMealAt).getTime()) / 3_600_000
            : 0;
          if (hoursSinceEat > 6 && penaltyStats.money > 0) {
            const penalty = Math.min(penaltyStats.money, Math.floor(hoursSinceEat / 6) * 3);
            penaltyStats = { ...penaltyStats, money: penaltyStats.money - penalty };
            if (!penaltyNotif.some((n) => n.id.startsWith("penalty-meal-"))) {
              penaltyNotif = appendNotification(penaltyNotif, {
                id: `penalty-meal-${today}`,
                kind: "needs",
                title: `🍽️ Tu n'as pas mangé — −${penalty} cr`,
                body: "Chaque heure sans repas te coûte des crédits. Mange !",
                createdAt: nowIso(), read: false,
              });
              void sendLocalNotification("🍽️ Mange maintenant !", `−${penalty} cr de pénalité.`).catch(() => {});
            }
          }

          // Pas dormi (énergie < 15 depuis longtemps) → perd réputation
          if (penaltyStats.energy < 15) {
            penaltyStats = { ...penaltyStats, reputation: Math.max(0, penaltyStats.reputation - 2) };
            if (!penaltyNotif.some((n) => n.id.startsWith("penalty-sleep-"))) {
              penaltyNotif = appendNotification(penaltyNotif, {
                id: `penalty-sleep-${today}`,
                kind: "needs",
                title: "😴 Épuisement — −2 rep",
                body: "Tu es épuisé. Les gens le voient. Dors.",
                createdAt: nowIso(), read: false,
              });
              void sendLocalNotification("😴 Dors maintenant !", "L'épuisement détruit ta réputation.").catch(() => {});
            }
          }

          // Pas travaillé depuis > 48h → perd motivation
          const hoursSinceWork = state.workSession?.startedAt
            ? (penaltyNow - new Date(state.workSession.startedAt).getTime()) / 3_600_000
            : 999;
          if (hoursSinceWork > 48 && penaltyStats.motivation > 5) {
            penaltyStats = { ...penaltyStats, motivation: Math.max(0, penaltyStats.motivation - 5), discipline: Math.max(0, penaltyStats.discipline - 3) };
            if (!penaltyNotif.some((n) => n.id.startsWith("penalty-work-"))) {
              penaltyNotif = appendNotification(penaltyNotif, {
                id: `penalty-work-${today}`,
                kind: "work",
                title: "💼 Sans travail — −5 motivation",
                body: "48h sans travailler. Tu perds le fil. Go bosser.",
                createdAt: nowIso(), read: false,
              });
              void sendLocalNotification("💼 Travaille !", "48h d'inactivité — tu perds ta motivation.").catch(() => {});
            }
          }

          // Score de richesse recalculé
          const newWealthScore = computeWealthScore(
            penaltyStats.money, state.playerXp, penaltyStats.reputation, penaltyStats.streak, state.housingTier, state.playerLevel
          );
          const rooms = [...state.rooms];
          DEFAULT_ROOMS.forEach((defaultRoom) => {
            if (!rooms.some((room) => room.id === defaultRoom.id)) {
              rooms.push(createDefaultRoom(defaultRoom));
            }
          });
          const joinedRooms = ["room-home-suite", "room-test-live", "room-lounge-global"].reduce<string[]>(
            (current, roomId) => current.includes(roomId) ? current : [...current, roomId],
            state.joinedRooms
          );

          return {
            stats: normalizeStats(penaltyStats),
            advice: buildAdvice(penaltyStats),
            notifications: penaltyNotif,
            invitations,
            datePlans,
            dailyEvent,
            lastKnownRank,
            dailyGoals,
            wealthScore: newWealthScore,
            rooms,
            joinedRooms,
            ...(goalsNeedReset ? { lastDailyGoalResetAt: today } : {})
          };
        }),
      performAction: (action) => set((state) => withActionApplied(state, action)),
      claimMission: (missionId) => set((state) => {
        const { updatedProgresses, xp, money } = claimMissionReward(state.missionProgresses ?? [], missionId);
        const newPlayerXp = (state.playerXp ?? 0) + xp;
        const newPlayerLevel = Math.max(1, Math.floor(newPlayerXp / 200) + 1);
        return {
          missionProgresses: updatedProgresses,
          playerXp: newPlayerXp,
          playerLevel: newPlayerLevel,
          stats: normalizeStats({ ...state.stats, money: state.stats.money + money }),
        };
      }),
      unlockTalent: (talentId) => set((state) => ({
        unlockedTalents: [...(state.unlockedTalents ?? []), talentId],
      })),
      travelTo: (locationSlug, options) =>
        set((state) => {
          const location = locations.find((item) => item.slug === locationSlug) ?? locations[0];
          const transportCost = Math.max(0, Math.round(options?.cost ?? 0));
          const energyCost = Math.max(1, Math.round(options?.energyCost ?? 2));
          const nextStats = normalizeStats({
            ...state.stats,
            mood: state.stats.mood + Math.max(1, Math.round(location.socialEnergy / 22)),
            sociability: state.stats.sociability + Math.max(1, Math.round(location.socialEnergy / 18)),
            energy: state.stats.energy - energyCost,
            money: state.stats.money - transportCost,
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
              body: `${options?.modeLabel ? `Trajet en ${options.modeLabel}. ` : ""}${transportCost > 0 ? `Transport -${transportCost} cr. ` : ""}${location.summary}`,
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
          const residentNpc = residentId ? state.npcs.find((npc) => npc.id === residentId) : null;
          const relationshipScore = residentId
            ? (relationships.find((relationship) => relationship.residentId === residentId)?.score ?? 0)
            : 0;
          const replyBody = isDirectConv && residentId
            ? buildDirectBotReply({
                npc: residentNpc,
                residentId,
                residentName: msgResident?.name ?? targetConversation?.title,
                playerName: state.avatar?.displayName ?? "Moi",
                playerMessage: cleanBody,
                relationshipScore,
                messageCount: selfMessages
              })
            : null;
          const reply = replyBody && residentId ? {
            id: `reply-ai-${residentId}-${Date.now()}`,
            authorId: residentId,
            body: replyBody,
            createdAt: nowIso(),
            read: false,
            kind: "message" as const
          } : null;

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
      likeResident: (residentId) =>
        set((state) => {
          const resident = starterResidents.find((item) => item.id === residentId);
          if (!resident) return state;
          return {
            relationships: updateRelationshipScore(state.relationships, residentId, 3, state.stats, resident.reputation),
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
      completeTutorial: () => set({ tutorialDone: true }),

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
      markConversationRead: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, unreadCount: 0, messages: c.messages.map((m) => ({ ...m, read: true })) }
              : c
          )
        })),

      // ── Premium ───────────────────────────────────────────────────────────
      activatePremium: (tier) => {
        const durationDays = tier === "yearly" ? 365 : 31;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        set((state) => ({
          isPremium: true,
          premiumTier: tier,
          premiumExpiresAt: expiresAt,
          notifications: appendNotification(state.notifications, {
            id: `premium-activated-${Date.now()}`,
            kind: "reward",
            title: "Premium activé",
            body: `Abonnement ${tier === "yearly" ? "annuel" : "mensuel"} actif. Toutes les features sont débloquées.`,
            createdAt: nowIso(),
            read: false
          })
        }));
        const session = get().session;
        if (session?.provider === "supabase" && supabase) {
          void supabase.auth.getUser().then(({ data }) => {
            const userId = data.user?.id;
            if (userId) void syncPremiumToSupabase(userId, tier, expiresAt);
          });
        }
      },
      deactivatePremium: () => set({ isPremium: false, premiumTier: null, premiumExpiresAt: null }),

      buyBoost: (boostId) => {
        const state = get();
        const boost = BOOSTS.find((b: BoostItem) => b.id === boostId);
        if (!boost) return { ok: false, error: "Boost introuvable." };
        if (state.stats.money < boost.price) return { ok: false, error: "Pas assez de crédits." };
        const activeUntil = new Date(Date.now() + boost.durationHours * 60 * 60 * 1000).toISOString();
        set((s) => ({
          stats: { ...s.stats, money: s.stats.money - boost.price },
          activeBoosts: [
            ...s.activeBoosts.filter((b) => b.id !== boostId),
            { ...boost, activeUntil }
          ],
          moneyTransfers: [
            {
              id: `boost-${Date.now()}`,
              kind: "boost" as const,
              residentId: null,
              residentName: null,
              amount: -boost.price,
              description: `Boost acheté : ${boost.name}`,
              createdAt: nowIso()
            },
            ...s.moneyTransfers
          ].slice(0, 100),
          notifications: appendNotification(s.notifications, {
            id: `boost-bought-${Date.now()}`,
            kind: "reward",
            title: `${boost.name} actif`,
            body: `${boost.description} Expire dans ${boost.durationHours}h.`,
            createdAt: nowIso(),
            read: false
          })
        }));
        return { ok: true };
      },

      buyCosmetic: (cosmeticId) => {
        const state = get();
        const cosmetic = COSMETICS.find((c: CosmeticItem) => c.id === cosmeticId);
        if (!cosmetic) return { ok: false, error: "Cosmétique introuvable." };
        if (cosmetic.requiresPremium && !state.isPremium) return { ok: false, error: "Réservé aux membres Premium." };
        if (cosmetic.price > 0 && state.stats.money < cosmetic.price) return { ok: false, error: "Pas assez de crédits." };
        if (state.equippedCosmetics.includes(cosmeticId)) return { ok: false, error: "Déjà équipé." };
        set((s) => ({
          stats: cosmetic.price > 0 ? { ...s.stats, money: s.stats.money - cosmetic.price } : s.stats,
          equippedCosmetics: [...s.equippedCosmetics, cosmeticId],
          moneyTransfers: cosmetic.price > 0 ? [
            {
              id: `cosmetic-${Date.now()}`,
              kind: "cosmetic" as const,
              residentId: null,
              residentName: null,
              amount: -cosmetic.price,
              description: `Cosmétique acheté : ${cosmetic.name}`,
              createdAt: nowIso()
            },
            ...s.moneyTransfers
          ].slice(0, 100) : s.moneyTransfers
        }));
        return { ok: true };
      },

      // ── Logement ──────────────────────────────────────────────────────────
      upgradeHousing: (tierId) => {
        const state = get();
        const tier  = getHousingTier(tierId);
        if (state.stats.money < tier.minMoney)        return { ok: false, error: `Il te faut ${tier.minMoney} crédits minimum.` };
        if (state.playerLevel < tier.minLevel)         return { ok: false, error: `Niveau ${tier.minLevel} requis.` };
        if (state.stats.reputation < tier.minReputation) return { ok: false, error: `Réputation ${tier.minReputation} requise.` };
        if (state.stats.streak < tier.minStreak)       return { ok: false, error: `Streak ${tier.minStreak} jours requis.` };
        const newWealth = computeWealthScore(state.stats.money, state.playerXp, state.stats.reputation, state.stats.streak, tierId, state.playerLevel);
        set((s) => ({
          housingTier:    tierId,
          housingLastPaidAt: nowIso(),
          wealthScore:    newWealth,
          notifications: appendNotification(s.notifications, {
            id: `housing-upgrade-${Date.now()}`,
            kind: "reward",
            title: `${tier.emoji} Tu as emménagé : ${tier.name}`,
            body: tier.description,
            createdAt: nowIso(),
            read: false,
          }),
        }));
        void sendLocalNotification(`${tier.emoji} Nouveau logement`, `Bienvenue dans ton ${tier.name} !`).catch(() => {});
        return { ok: true };
      },

      checkHousingRent: () => set((s) => {
        const tier = getHousingTier(s.housingTier);
        if (tier.rentPerDay === 0) {
          // Squat : pénalité passive humeur
          if (s.stats.mood > 5) {
            return { stats: normalizeStats({ ...s.stats, mood: s.stats.mood - 0.5, reputation: Math.max(0, s.stats.reputation - 0.1) }) };
          }
          return {};
        }
        const now  = Date.now();
        const last = s.housingLastPaidAt ? new Date(s.housingLastPaidAt).getTime() : now;
        const hoursOwed = Math.floor((now - last) / (1000 * 60 * 60));
        if (hoursOwed < 24) return {};

        const daysOwed = Math.floor(hoursOwed / 24);
        const due = tier.rentPerDay * daysOwed;

        if (s.stats.money >= due) {
          // Paiement OK → bonus logement
          const newWealth = computeWealthScore(s.stats.money - due, s.playerXp, s.stats.reputation, s.stats.streak, s.housingTier, s.playerLevel);
          return {
            stats: normalizeStats({
              ...s.stats,
              money: s.stats.money - due,
              mood: Math.min(100, s.stats.mood + tier.moodBonus * 0.1),
              reputation: Math.min(100, s.stats.reputation + tier.reputationBonus * 0.05),
            }),
            housingLastPaidAt: new Date(now).toISOString(),
            wealthScore: newWealth,
          };
        } else {
          // Pas assez d'argent → rétrogradation
          const newTier: HousingTierId = s.housingTier === "manoir" ? "villa"
            : s.housingTier === "villa" ? "penthouse"
            : s.housingTier === "penthouse" ? "loft"
            : s.housingTier === "loft" ? "appartement"
            : s.housingTier === "appartement" ? "studio"
            : "squat";
          void sendLocalNotification("⬇️ Loyer impayé", `Tu n'avais pas assez de crédits — rétrogradé en ${newTier}.`).catch(() => {});
          return {
            housingTier: newTier,
            housingLastPaidAt: new Date(now).toISOString(),
            stats: normalizeStats({
              ...s.stats,
              money: 0,
              mood: Math.max(0, s.stats.mood - 20),
              reputation: Math.max(0, s.stats.reputation - 10),
            }),
            notifications: appendNotification(s.notifications, {
              id: `housing-evict-${Date.now()}`,
              kind: "social",
              title: "⬇️ Loyer impayé — Rétrogradé",
              body: `Tu n'avais pas assez. Tu vis maintenant dans un ${newTier}.`,
              createdAt: nowIso(),
              read: false,
            }),
          };
        }
      }),

      // ── Économie sociale ──────────────────────────────────────────────────
      sendMoneyToResident: (residentId, residentName, amount) => {
        const state = get();
        if (amount <= 0) return { ok: false, error: "Montant invalide." };
        if (amount > state.stats.money) return { ok: false, error: "Solde insuffisant." };
        if (amount > 200) return { ok: false, error: "Maximum 200 crédits par transfert." };
        const resident = starterResidents.find((r) => r.id === residentId);
        if (!resident) return { ok: false, error: "Résident introuvable." };
        const createdAt = nowIso();
        set((s) => ({
          stats: normalizeStats({ ...s.stats, money: s.stats.money - amount, sociability: s.stats.sociability + 4, reputation: s.stats.reputation + 2, lastDecayAt: createdAt }),
          moneyTransfers: [
            {
              id: `transfer-${Date.now()}`,
              kind: "sent" as const,
              residentId,
              residentName,
              amount: -amount,
              description: `Envoyé à ${residentName}`,
              createdAt
            },
            ...s.moneyTransfers
          ].slice(0, 100),
          relationships: updateRelationshipScore(s.relationships, residentId, 10, s.stats, resident.reputation, "ami"),
          notifications: appendNotification(s.notifications, {
            id: `transfer-notif-${Date.now()}`,
            kind: "social",
            title: `${amount} crédits envoyés`,
            body: `${residentName} a reçu ${amount} crédits. Le lien se renforce.`,
            createdAt,
            read: false
          }),
          lifeFeed: appendFeed(s.lifeFeed, {
            id: `feed-transfer-${Date.now()}`,
            title: "Transfert social",
            body: `Tu as envoyé ${amount} crédits à ${residentName}. Partager est un signal fort.`,
            createdAt
          })
        }));
        // Log async dans Supabase si configuré
        const { supabaseAvatarId } = get();
        if (supabaseAvatarId) {
          void logSocialTransferToSupabase(supabaseAvatarId, residentId, amount, `Envoyé à ${residentName}`);
        }
        return { ok: true };
      },

      // ── Work — sessions + XP ──────────────────────────────────────────────
      startWorkShift: (jobSlug) => {
        const job = getStarterJob(jobSlug);
        const durationSec = 5 + (job.energyCost / 5);
        const state = get();
        const boostMultiplier = getBoostMultiplier(state.activeBoosts);
        const level = state.jobLevel;
        const levelBonus = 1 + (level - 1) * 0.05;
        const timeMult = getActionTimeScore("work-shift", getTimeContext()).multiplier;
        const earnedCoins = Math.round(applyMomentumGain(job.rewardCoins, state.stats) * boostMultiplier * levelBonus * timeMult);
        const earnedXp = Math.round(15 + job.disciplineReward * 0.5);
        const earnedDiscipline = Math.round(applyMomentumGain(job.disciplineReward, state.stats) * boostMultiplier * timeMult);
        const earnedReputation = job.reputationReward;
        set({
          workSession: {
            phase: "active",
            startedAt: nowIso(),
            durationSec: Math.max(4, Math.round(durationSec)),
            jobSlug,
            earnedCoins,
            earnedXp,
            earnedDiscipline,
            earnedReputation,
          }
        });
      },

      completeWorkShift: () => {
        const state = get();
        const { workSession, stats, jobXp, jobLevel, avatar, shiftHistory } = state;
        if (workSession.phase !== "active") return;
        const job = getStarterJob(workSession.jobSlug);
        const newRawXp = jobXp + workSession.earnedXp;
        const newLevel = Math.min(10, Math.floor(newRawXp / 100) + 1);
        const newXp = newRawXp % 100;
        const createdAt = nowIso();
        const newRecord: import("@/lib/types").ShiftRecord = {
          id: `shift-${Date.now()}`,
          jobSlug: workSession.jobSlug,
          jobName: job.name,
          earnedCoins: workSession.earnedCoins,
          earnedXp: workSession.earnedXp,
          completedAt: createdAt,
        };
        const nextStats = normalizeStats({
          ...stats,
          money: stats.money + workSession.earnedCoins,
          energy: stats.energy - job.energyCost,
          hunger: stats.hunger - job.hungerCost,
          stress: stats.stress + job.stressCost,
          discipline: stats.discipline + workSession.earnedDiscipline,
          reputation: stats.reputation + workSession.earnedReputation,
          motivation: stats.motivation + 3,
          lastDecayAt: createdAt,
        });
        const leveledUp = newLevel > jobLevel;
        set((s) => ({
          workSession: { ...workSession, phase: "completed" },
          jobXp: newXp,
          jobLevel: newLevel,
          shiftHistory: [newRecord, ...s.shiftHistory].slice(0, 10),
          stats: nextStats,
          dailyGoals: updateGoal(s.dailyGoals, ["travailler", "produire"]),
          notifications: appendNotification(s.notifications, {
            id: `work-done-${Date.now()}`,
            kind: "work",
            title: leveledUp ? `Niveau ${newLevel} atteint !` : "Shift terminé",
            body: leveledUp
              ? `Tu passes au niveau ${newLevel} — +5% revenus par shift.`
              : `+${workSession.earnedCoins} crédits · +${workSession.earnedXp} XP · ${job.name}`,
            createdAt,
            read: false,
          }),
          lifeFeed: appendFeed(s.lifeFeed, {
            id: `feed-work-${Date.now()}`,
            title: "Session de travail terminée",
            body: `${job.name} — ${workSession.earnedCoins} crédits gagnés. Discipline renforcée.`,
            createdAt,
          }),
          moneyTransfers: [
            {
              id: `work-pay-${Date.now()}`,
              kind: "received" as const,
              residentId: null,
              residentName: null,
              amount: workSession.earnedCoins,
              description: `Shift — ${job.name}`,
              createdAt,
            },
            ...s.moneyTransfers,
          ].slice(0, 100),
        }));
      },

      cancelWorkShift: () => {
        set((s) => ({
          workSession: { ...s.workSession, phase: "idle", startedAt: null },
        }));
      },

      // ── NPCs ──────────────────────────────────────────────────────────────
      recordStudySession: (input) => {
        const state = get();
        const current = state.studyProgress.find((item) => item.moduleId === input.moduleId);
        const sessionsCompleted = Math.min(input.totalSessions, (current?.sessionsCompleted ?? 0) + 1);
        const level =
          sessionsCompleted >= input.totalSessions ? 3 :
          sessionsCompleted >= Math.floor(input.totalSessions * 0.67) ? 2 :
          sessionsCompleted >= Math.floor(input.totalSessions * 0.33) ? 1 :
          0;
        const progressPct = Math.min(100, Math.round((sessionsCompleted / input.totalSessions) * 100));
        const updatedAt = nowIso();
        const progress: StudyProgress = {
          moduleId: input.moduleId,
          title: input.title,
          sessionsCompleted,
          level,
          xp: (current?.xp ?? 0) + input.xpPerSession,
          progressPct,
          updatedAt,
          completedAt: level === 3 ? (current?.completedAt ?? updatedAt) : null
        };

        set((s) => ({
          studyProgress: [
            progress,
            ...s.studyProgress.filter((item) => item.moduleId !== input.moduleId)
          ]
        }));

        const avatarId = state.supabaseAvatarId;
        if (avatarId) {
          void syncStudyProgressToSupabase(
            avatarId,
            progress.moduleId,
            progress.title,
            progress.progressPct,
            progress.level,
            progress.xp,
            progress.completedAt
          );
        }

        return progress;
      },

      tickNpcs: () => set((s) => {
        const prevNpcs = s.npcs;
        const tickedNpcs = tickAllNpcs(s.npcs);
        const playerName = s.avatar?.displayName ?? "ami";

        const { events, updatedNpcs } = generateNpcEvents(
          tickedNpcs, prevNpcs, s.relationships, playerName
        );

        let conversations = [...s.conversations];
        let invitations   = [...s.invitations];
        let notifications = [...s.notifications];
        let lifeFeed      = [...s.lifeFeed];

        for (const event of events) {
          if (event.kind === "message" && event.message) {
            // Injecter le message dans la conversation DM existante
            const convIdx = conversations.findIndex(
              (c) => c.peerId === event.npcId && c.kind === "direct"
            );
            if (convIdx >= 0) {
              conversations = conversations.map((c, i) => {
                if (i !== convIdx) return c;
                return {
                  ...c,
                  unreadCount: c.unreadCount + 1,
                  messages: [
                    ...c.messages,
                    {
                      id:        `npc-msg-${Date.now()}-${event.npcId}`,
                      authorId:  event.npcId,
                      body:      event.message!,
                      createdAt: nowIso(),
                      read:      false,
                      kind:      "message" as const,
                    },
                  ],
                };
              });
            }
            notifications = appendNotification(notifications, {
              id:        `npc-notif-${Date.now()}-${event.npcId}`,
              kind:      "social",
              title:     `💬 ${event.npcName} t'a écrit`,
              body:      (event.message ?? "").slice(0, 80),
              createdAt: nowIso(),
              read:      false,
            });
            // Push notification système (si app en arrière-plan)
            void sendLocalNotification(
              `💬 ${event.npcName} t'a écrit`,
              (event.message ?? "").slice(0, 80)
            ).catch(() => {});
          }

          if (event.kind === "invitation" && event.activitySlug) {
            // Éviter doublons : ne pas ré-inviter si déjà en pending
            const alreadyPending = invitations.some(
              (inv) => inv.residentId === event.npcId && inv.status === "pending"
            );
            if (!alreadyPending) {
              invitations = [
                ...invitations,
                {
                  id:           `npc-invite-${Date.now()}-${event.npcId}`,
                  residentId:   event.npcId,
                  residentName: event.npcName,
                  activitySlug: event.activitySlug!,
                  status:       "pending" as const,
                  createdAt:    nowIso(),
                },
              ];
              notifications = appendNotification(notifications, {
                id:        `npc-invite-notif-${Date.now()}-${event.npcId}`,
                kind:      "social",
                title:     `🎯 ${event.npcName} t'invite`,
                body:      `${event.npcName} propose : ${event.activityLabel ?? event.activitySlug}`,
                createdAt: nowIso(),
                read:      false,
              });
              void sendLocalNotification(
                `🎯 ${event.npcName} t'invite`,
                `Proposition : ${event.activityLabel ?? event.activitySlug}`
              ).catch(() => {});
            }
          }

          if (event.kind === "level_up") {
            notifications = appendNotification(notifications, {
              id:        `npc-lvl-${Date.now()}-${event.npcId}`,
              kind:      "reward",
              title:     `⬆️ ${event.npcName} — Niveau ${event.newLevel} !`,
              body:      `${event.npcName} évolue et gagne en influence dans la ville.`,
              createdAt: nowIso(),
              read:      false,
            });
            lifeFeed = appendFeed(lifeFeed, {
              id:        `feed-npc-lvl-${Date.now()}`,
              title:     `${event.npcName} a passé niveau ${event.newLevel}`,
              body:      `+${event.xpGained ?? 0} XP — ${event.npcName} continue de progresser.`,
              createdAt: nowIso(),
            });
          }

          if (event.kind === "activity_done" && (event.xpGained ?? 0) >= 5) {
            lifeFeed = appendFeed(lifeFeed, {
              id:        `feed-npc-act-${Date.now()}-${event.npcId}`,
              title:     `${event.npcName} a ${event.activityLabel}`,
              body:      `+${event.xpGained} XP${event.moneyGained ? ` · +${event.moneyGained} cr` : ""}`,
              createdAt: nowIso(),
            });
          }
        }

        // ── Présence amis : détection "vient de se connecter" ────────────────
        const now = Date.now();
        const finalNpcs = updatedNpcs.map((npc) => {
          const prev = prevNpcs.find((p) => p.id === npc.id);
          const canBeOnline = npc.energy > 25 && npc.mood > 20 && npc.action !== "sleeping";
          // Probabilité de transition : 15% chance online/tick si conditions ok, 10% offline
          const roll = Math.random();
          let presenceOnline = npc.presenceOnline ?? false;
          let lastOnlineAt   = npc.lastOnlineAt ?? null;

          if (!presenceOnline && canBeOnline && roll < 0.15) {
            presenceOnline = true;
            lastOnlineAt   = new Date(now).toISOString();

            // Notif si c'est un ami (score > 50)
            const rel = s.relationships.find((r) => r.residentId === npc.id);
            const wasOffline = !(prev?.presenceOnline ?? false);
            if (rel && rel.score >= 50 && wasOffline) {
              notifications = appendNotification(notifications, {
                id:        `presence-${now}-${npc.id}`,
                kind:      "social",
                title:     `🟢 ${npc.name} est connecté(e)`,
                body:      `${npc.name} vient de se connecter — dis-lui bonjour !`,
                createdAt: new Date(now).toISOString(),
                read:      false,
              });
              void sendLocalNotification(
                `🟢 ${npc.name} est en ligne`,
                `${npc.name} vient de se connecter — dis-lui bonjour !`
              ).catch(() => {});
            }
          } else if (presenceOnline && (!canBeOnline || roll < 0.08)) {
            presenceOnline = false;
          }

          return { ...npc, presenceOnline, lastOnlineAt };
        });

        // ── NPC auto-messages dans le Lounge ──────────────────────────────────
        const loungeMessages = s.roomMessages["room-lounge-global"] ?? [];
        const lastLoungeAt = loungeMessages.length > 0
          ? new Date(loungeMessages[loungeMessages.length - 1].createdAt).getTime()
          : 0;
        let newLoungeMessages = [...loungeMessages];
        if (now - lastLoungeAt > 45_000) {
          const onlineNpcs = finalNpcs.filter((n) => n.presenceOnline);
          if (onlineNpcs.length > 0 && Math.random() < 0.6) {
            const npc = onlineNpcs[Math.floor(Math.random() * onlineNpcs.length)];
            const body = buildNpcLoungeMessage(npc);
            newLoungeMessages = [...newLoungeMessages, {
              id: `lounge-npc-${now}-${npc.id}`,
              authorId: npc.id,
              authorName: npc.name,
              body,
              createdAt: new Date(now).toISOString(),
              kind: "message" as const,
            }].slice(-100);
          }
        }

        return {
          npcs:          finalNpcs,
          conversations,
          invitations,
          notifications,
          lifeFeed,
          roomMessages: {
            ...s.roomMessages,
            "room-lounge-global": newLoungeMessages,
          },
        };
      }),

      // ── Rooms live ────────────────────────────────────────────────────────
      createRoom: (name, description, kind) => {
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const state = get();
        const ownerName = state.avatar?.displayName ?? "Anonyme";
        const ownerId   = state.session?.email ?? "local";
        const room: Room = {
          id:          `room-${Date.now()}`,
          name,
          kind,
          code,
          ownerId,
          ownerName,
          locationSlug: state.currentLocationSlug,
          memberCount:  1,
          maxMembers:   20,
          description,
          createdAt:   nowIso(),
          isActive:    true
        };
        set((s) => ({
          rooms: [room, ...s.rooms].slice(0, 50),
          joinedRooms: s.joinedRooms.includes(room.id) ? s.joinedRooms : [...s.joinedRooms, room.id],
          roomMessages: {
            ...s.roomMessages,
            [room.id]: s.roomMessages[room.id] ?? [{
              id: `sys-create-${Date.now()}`,
              authorId: "system",
              authorName: "Système",
              body: `Room "${name}" créée — partage le code ${code} pour inviter.`,
              createdAt: nowIso(),
              kind: "system" as const,
            }]
          }
        }));
        return room;
      },
      joinRoom: (code) => {
        const state = get();
        const upperCode = code.toUpperCase();
        let room = state.rooms.find((r) => r.code === upperCode && r.isActive);
        if (!room) {
          room = defaultRoomByCode(upperCode);
        }
        if (room && !state.rooms.some((candidate) => candidate.id === room!.id)) {
          set((s) => ({
            rooms: [room!, ...s.rooms.filter((r) => r.id !== room!.id)].slice(0, 50),
            joinedRooms: s.joinedRooms.includes(room!.id) ? s.joinedRooms : [...s.joinedRooms, room!.id]
          }));
        }
        if (!room) return null;
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === room.id
              ? { ...r, memberCount: s.joinedRooms.includes(r.id) ? r.memberCount : Math.min(r.memberCount + 1, r.maxMembers) }
              : r
          ),
          joinedRooms: s.joinedRooms.includes(room.id) ? s.joinedRooms : [...s.joinedRooms, room.id],
          roomMessages: {
            ...s.roomMessages,
            [room.id]: s.roomMessages[room.id] ?? [{
              id: `sys-join-${Date.now()}`,
              authorId: "system",
              authorName: "Système",
              body: `Tu as rejoint "${room.name}".`,
              createdAt: nowIso(),
              kind: "system" as const,
            }]
          }
        }));
        return room;
      },
      leaveRoom: (roomId) => {
        const state = get();
        const room = state.rooms.find((r) => r.id === roomId);
        if (!room) return;
        const isOwner = room.ownerId === (state.session?.email ?? "local");
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === roomId
              ? { ...r, memberCount: Math.max(0, r.memberCount - 1), isActive: isOwner ? false : r.isActive }
              : r
          ),
          joinedRooms: s.joinedRooms.filter((id) => id !== roomId),
        }));
      },

      sendRoomMessage: (roomId, body) => {
        const state = get();
        const authorId   = state.session?.email ?? "local";
        const authorName = state.avatar?.displayName ?? "Moi";
        const msg: RoomMessage = {
          id:         `rm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          authorId,
          authorName,
          body:       body.trim(),
          createdAt:  nowIso(),
          kind:       "message",
        };
        const current = state.roomMessages[roomId] ?? [];

        // Auto-réponse NPC (30% chance, délai simulé)
        const npcReplies: RoomMessage[] = [];
        const onlineNpcs = state.npcs.filter((n) => n.presenceOnline);
        if (false && onlineNpcs.length > 0 && Math.random() < 0.35) {
          const npc = onlineNpcs[Math.floor(Math.random() * onlineNpcs.length)];
          const REPLIES = [
            "Bien dit 👌", "Je suis d'accord !", "Ah intéressant 🤔", "Lol 😂", "🔥🔥",
            "Bonne question", "C'est vrai ça !", "On est là 💪", "Haha exactement", "✨",
            "Ouais, pareil pour moi", "Ça marche !", "T'as raison", "Nice !", "💯"
          ];
          npcReplies.push({
            id:         `rm-npc-${Date.now()}-${npc.id}`,
            authorId:   npc.id,
            authorName: npc.name,
            body:       REPLIES[Math.floor(Math.random() * REPLIES.length)],
            createdAt:  new Date(Date.now() + 2000).toISOString(),
            kind:       "message",
          });
        }

        const room = state.rooms.find((candidate) => candidate.id === roomId);
        const aiReplies = buildRoomBotReplies({
          roomId,
          roomName: room?.name ?? "Room",
          playerName: authorName,
          playerMessage: body,
          onlineNpcs: state.npcs.filter((n) => n.presenceOnline),
          maxReplies: room?.kind === "private" ? 2 : 3
        });

        set((s) => ({
          roomMessages: {
            ...s.roomMessages,
            [roomId]: [...(s.roomMessages[roomId] ?? []), msg, ...npcReplies, ...aiReplies].slice(-200),
          },
        }));
      },

      createPrivateRoom: (name) => {
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const state = get();
        const ownerName = state.avatar?.displayName ?? "Anonyme";
        const ownerId   = state.session?.email ?? "local";
        const room: Room = {
          id:          `room-priv-${Date.now()}`,
          name,
          kind:        "private",
          code,
          ownerId,
          ownerName,
          locationSlug: state.currentLocationSlug,
          memberCount:  1,
          maxMembers:   10,
          description:  `Room privée de ${ownerName}`,
          createdAt:   nowIso(),
          isActive:    true,
        };
        set((s) => ({
          rooms: [room, ...s.rooms].slice(0, 50),
          joinedRooms: [...s.joinedRooms, room.id],
          roomMessages: { ...s.roomMessages, [room.id]: [{
            id: `sys-create-${Date.now()}`,
            authorId: "system",
            authorName: "Système",
            body: `Room "${name}" créée — partage le code ${code} pour inviter`,
            createdAt: nowIso(),
            kind: "system" as const,
          }]},
        }));
        return room;
      },

      inviteNpcToRoom: (roomId, residentId) => {
        const state = get();
        const room = state.rooms.find((r) => r.id === roomId);
        if (!room) return;
        const npc = state.npcs.find((n) => n.id === residentId);
        if (!npc) return;
        const invite: RoomInvite = {
          id:       `rinvite-${Date.now()}-${residentId}`,
          roomId,
          roomName: room.name,
          fromId:   state.session?.email ?? "local",
          fromName: state.avatar?.displayName ?? "Moi",
          toId:     residentId,
          status:   "pending",
          createdAt: nowIso(),
        };
        // NPC accepte automatiquement si relation > 30, sinon 50% chance
        const rel = state.relationships.find((r) => r.residentId === residentId);
        const accepted = rel ? rel.score > 30 : Math.random() > 0.5;
        const finalInvite: RoomInvite = { ...invite, status: accepted ? "accepted" : "declined" };

        set((s) => {
          const msgs = s.roomMessages[roomId] ?? [];
          const sysMsg: RoomMessage = {
            id: `sys-invite-${Date.now()}`,
            authorId: "system",
            authorName: "Système",
            body: accepted
              ? `${npc.name} a rejoint la room 🎉`
              : `${npc.name} a décliné l'invitation.`,
            createdAt: nowIso(),
            kind: "system",
          };
          return {
            roomInvites: [...s.roomInvites, finalInvite],
            rooms: s.rooms.map((r) =>
              r.id === roomId
                ? { ...r, memberCount: accepted ? r.memberCount + 1 : r.memberCount }
                : r
            ),
            roomMessages: {
              ...s.roomMessages,
              [roomId]: [...msgs, sysMsg].slice(-200),
            },
          };
        });

        void sendLocalNotification(
          accepted ? `✅ ${npc.name} a rejoint la room` : `❌ ${npc.name} a décliné`,
          accepted ? `${npc.name} est maintenant dans "${room.name}"` : `${npc.name} n'est pas disponible.`
        ).catch(() => {});
      },

      respondRoomInvite: (inviteId, status) => {
        set((s) => ({
          roomInvites: s.roomInvites.map((i) =>
            i.id === inviteId ? { ...i, status } : i
          ),
          joinedRooms: status === "accepted"
            ? (() => {
                const roomId = s.roomInvites.find((i) => i.id === inviteId)?.roomId;
                if (!roomId || s.joinedRooms.includes(roomId)) return s.joinedRooms;
                return [...s.joinedRooms, roomId];
              })()
            : s.joinedRooms,
        }));
      },

      // ── Secret Rooms éphémères ────────────────────────────────────────────
      createSecretRoom: (name) => {
        const state = get();
        const userId = state.session?.email ?? "local";
        const ownerName = state.avatar?.displayName ?? "Anonyme";
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room: SecretRoom = {
          id: `secret-${Date.now()}`,
          name,
          code,
          ownerId: userId,
          ownerName,
          memberIds: [userId],
          maxMembers: 4,
          expiresAt,
          createdAt: now.toISOString(),
          isActive: true,
        };
        const systemMsg: SecretMessage = {
          id: `sys-${Date.now()}`,
          authorId: "system",
          authorName: "Système",
          body: `🔐 Room secrète créée. Code : ${code}. Expire dans 2h. Max 4 personnes.`,
          createdAt: now.toISOString(),
          expiresAt,
        };
        set((s) => ({
          secretRooms: [room, ...s.secretRooms],
          secretMessages: { ...s.secretMessages, [room.id]: [systemMsg] },
        }));
        return room;
      },

      joinSecretRoom: (code) => {
        const state = get();
        const userId = state.session?.email ?? "local";
        const now = new Date().toISOString();
        const room = state.secretRooms.find(
          (r) => r.code === code.toUpperCase() && r.isActive && r.expiresAt > now
        );
        if (!room) return null;
        if (room.memberIds.length >= room.maxMembers) return null;
        if (room.memberIds.includes(userId)) return room;
        const ownerName = state.avatar?.displayName ?? "Anonyme";
        const updated: SecretRoom = { ...room, memberIds: [...room.memberIds, userId] };
        const joinMsg: SecretMessage = {
          id: `sys-${Date.now()}`,
          authorId: "system",
          authorName: "Système",
          body: `👤 ${ownerName} a rejoint la room.`,
          createdAt: now,
          expiresAt: room.expiresAt,
        };
        set((s) => ({
          secretRooms: s.secretRooms.map((r) => r.id === room.id ? updated : r),
          secretMessages: {
            ...s.secretMessages,
            [room.id]: [...(s.secretMessages[room.id] ?? []), joinMsg],
          },
        }));
        return updated;
      },

      leaveSecretRoom: (roomId) => {
        const state = get();
        const userId = state.session?.email ?? "local";
        const room = state.secretRooms.find((r) => r.id === roomId);
        if (!room) return;
        const memberIds = room.memberIds.filter((id) => id !== userId);
        const isOwner = room.ownerId === userId;
        set((s) => ({
          secretRooms: s.secretRooms.map((r) =>
            r.id === roomId
              ? { ...r, memberIds, isActive: isOwner ? false : r.isActive }
              : r
          ),
        }));
      },

      sendSecretMessage: (roomId, body) => {
        const state = get();
        const userId = state.session?.email ?? "local";
        const authorName = state.avatar?.displayName ?? "Moi";
        const room = state.secretRooms.find((r) => r.id === roomId);
        if (!room || !room.isActive) return;
        const now = new Date().toISOString();
        if (now > room.expiresAt) {
          set((s) => ({
            secretRooms: s.secretRooms.map((r) => r.id === roomId ? { ...r, isActive: false } : r),
          }));
          return;
        }
        const msg: SecretMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          authorId: userId,
          authorName,
          body,
          createdAt: now,
          expiresAt: room.expiresAt,
        };
        set((s) => ({
          secretMessages: {
            ...s.secretMessages,
            [roomId]: [...(s.secretMessages[roomId] ?? []), msg],
          },
        }));
      },

      purgeExpiredSecretRooms: () => {
        const now = new Date().toISOString();
        set((s) => {
          const expiredIds = s.secretRooms
            .filter((r) => r.expiresAt <= now)
            .map((r) => r.id);
          if (expiredIds.length === 0) return s;
          const newMessages = { ...s.secretMessages };
          expiredIds.forEach((id) => delete newMessages[id]);
          return {
            secretRooms: s.secretRooms.filter((r) => !expiredIds.includes(r.id)),
            secretMessages: newMessages,
          };
        });
      },

      // ── Sync Supabase ─────────────────────────────────────────────────────
      syncToSupabase: async () => {
        const state = get();
        if (!state.session || state.session.provider !== "supabase" || !state.avatar) return;
        if (!supabase) return;
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return;
        const { avatarId } = await syncAvatarToSupabase(userId, state.avatar, state.stats);
        if (avatarId) {
          set({ supabaseAvatarId: avatarId });
          await syncStatsToSupabase(avatarId, state.stats);
          if (state.isPremium && state.premiumTier && state.premiumExpiresAt) {
            await syncPremiumToSupabase(userId, state.premiumTier, state.premiumExpiresAt);
          }
          await Promise.all(state.studyProgress.map((progress) =>
            syncStudyProgressToSupabase(
              avatarId,
              progress.moduleId,
              progress.title,
              progress.progressPct,
              progress.level,
              progress.xp,
              progress.completedAt
            )
          ));
          await syncProgressionToSupabase(avatarId, {
            playerXp: state.playerXp ?? 0,
            playerLevel: state.playerLevel ?? 1,
            unlockedTalents: state.unlockedTalents ?? [],
            missionsClaimed: (state.missionProgresses ?? []).filter((p) => p.status === "claimed").length,
          });
        }
      },

      resetAll: () => {
        void AsyncStorage.removeItem("mylife-storage");
        set({ ...initialState(), hasHydrated: true });
      }
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
        lifeFeed: state.lifeFeed,
        npcs: state.npcs,
        rooms: state.rooms,
        secretRooms: state.secretRooms,
        secretMessages: state.secretMessages,
        isPremium: state.isPremium,
        premiumTier: state.premiumTier,
        premiumExpiresAt: state.premiumExpiresAt,
        activeBoosts: state.activeBoosts,
        equippedCosmetics: state.equippedCosmetics,
        moneyTransfers: state.moneyTransfers,
        studyProgress: state.studyProgress,
        supabaseAvatarId: state.supabaseAvatarId,
        playerXp: state.playerXp,
        playerLevel: state.playerLevel,
        missionProgresses: state.missionProgresses,
        unlockedTalents: state.unlockedTalents,
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
