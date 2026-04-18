export type UserSession = {
  email: string;
  provider: "local" | "supabase";
};

export type SocialRank = "precaire" | "modeste" | "stable" | "confortable" | "influent" | "elite";
export type MentalStabilityState = "stable" | "fragile" | "sature";
export type RelationshipQuality = "inspirante" | "stable" | "neutre" | "fatigante" | "toxique";
export type PresenceState = "online" | "recent" | "busy" | "out" | "working" | "resting";
export type RelationshipStatus = "contact" | "ami" | "cercle-proche" | "crush" | "relation";
export type LocationKind = "home" | "food" | "social" | "work" | "wellness" | "public";
export type ActivityKind = "solo" | "social" | "romantic" | "wellness" | "work";
export type OutingIntensity = "chill" | "normale" | "festive";
export type OutingContext = "solo" | "amis" | "romantique" | "groupe";

export type OutingConfig = {
  activitySlug: string;
  intensity: OutingIntensity;
  context: OutingContext;
};

export type OutingResult = {
  label: string;
  energyCost: number;
  moodGain: number;
  sociabilityGain: number;
  stressDelta: number;
  budgetCost: number;
  disciplineDelta: number;
  weightDelta: number;
  fitnessDelta: number;
  socialQualityHint: "haute" | "moyenne" | "basse";
};
export type DailyEventKind = "opportunity" | "encounter" | "setback" | "windfall" | "social";
export type MomentumTier = "fragile" | "building" | "active" | "locked-in";
export type DateVenueKind = "coffee" | "park" | "cinema" | "restaurant";
export type DatePlanStatus = "proposed" | "accepted" | "declined" | "completed";

export type DailyEventEffects = {
  money?: number;
  energy?: number;
  mood?: number;
  sociability?: number;
  stress?: number;
  discipline?: number;
  reputation?: number;
  fitness?: number;
  motivation?: number;
  hygiene?: number;
};

export type DailyEvent = {
  id: string;
  kind: DailyEventKind;
  title: string;
  body: string;
  actionLabel: string;
  skipLabel: string;
  effects: DailyEventEffects;
  skipEffects: DailyEventEffects;
  createdAt: string;
  resolved: boolean;
  choice: "accepted" | "skipped" | null;
};

export type LifePattern =
  | "burnout"
  | "social_drought"
  | "grind_mode"
  | "productive_isolated"
  | "neglect"
  | "momentum"
  | "recovery_needed"
  | "image_gap"
  | "equilibre";

export type GuidanceItem = {
  id: string;
  title: string;
  body: string;
  action: string;
  category: "energy" | "social" | "budget" | "discipline" | "wellbeing";
  urgency: "high" | "medium" | "low";
};

export type MomentumState = {
  tier: MomentumTier;
  multiplier: number;
  label: string;
  hint: string;
  nextMilestone: number | null;
};

export type NotificationKind = "needs" | "social" | "work" | "reward" | "tip";
export type ConversationKind = "local" | "direct";
export type ConversationMessageKind = "message" | "system" | "invitation";
export type InvitationStatus = "pending" | "accepted" | "declined";

export type LifeActionId =
  | "healthy-meal"
  | "comfort-meal"
  | "hydrate"
  | "sleep"
  | "shower"
  | "reset"
  | "work-shift"
  | "focus-task"
  | "walk"
  | "gym"
  | "cafe-chat"
  | "restaurant-outing"
  | "cinema-date"
  | "rest-home"
  | "go-out"
  | "meditate"
  | "home-cooking"
  | "read-book"
  | "shopping"
  | "team-sport"
  | "nap";

export type AvatarProfile = {
  displayName: string;
  ageRange: string;
  gender: string;
  originStyle: string;
  photoStyle: string;
  bio: string;
  heightCm: number;
  weightKg: number;
  bodyFrame: string;
  skinTone: string;
  hairType: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  outfitStyle: string;
  facialHair: string;
  silhouette: string;
  personalityTrait: string;
  sociabilityStyle: string;
  ambition: string;
  lifeRhythm: string;
  interests: string[];
  leisureStyles: string[];
  relationshipStyle: string;
  personalGoal: string;
  lifeHabit: string;
  lookingFor: string[];
  friendshipIntent: string;
  romanceIntent: string;
  favoriteActivities: string[];
  favoriteOutings: string[];
  preferredVibe: string;
  appreciatedTraits: string[];
  starterJob: string;
};

export type AvatarStats = {
  hunger: number;
  hydration: number;
  energy: number;
  hygiene: number;
  mood: number;
  sociability: number;
  health: number;
  fitness: number;
  stress: number;
  money: number;
  socialRankScore: number;
  reputation: number;
  discipline: number;
  motivation: number;
  weight: number;
  attractiveness: number;
  mentalStability: MentalStabilityState;
  streak: number;
  lastDecayAt: string;
  lastMealAt: string;
  lastWorkoutAt: string;
  lastSocialAt: string;
};

export type NeighborhoodSeed = {
  slug: string;
  name: string;
  vibe: string;
  lifestyle: string;
  costLevel: "accessible" | "balanced" | "premium";
};

export type LocationSeed = {
  slug: string;
  neighborhoodSlug: string;
  name: string;
  kind: LocationKind;
  summary: string;
  costHint: string;
  socialEnergy: number;
};

export type JobSeed = {
  slug: string;
  name: string;
  rewardCoins: number;
  energyCost: number;
  hungerCost: number;
  stressCost: number;
  disciplineReward: number;
  reputationReward: number;
};

export type ActivitySeed = {
  slug: string;
  name: string;
  kind: ActivityKind;
  locationSlug: string;
  summary: string;
  cost: number;
  energyDelta: number;
  moodDelta: number;
  sociabilityDelta: number;
  fitnessDelta: number;
  stressDelta: number;
  weightDelta: number;
  disciplineDelta: number;
};

export type ResidentSeed = {
  id: string;
  name: string;
  ageRange: string;
  role: string;
  locationSlug: string;
  vibe: string;
  bio: string;
  interests: string[];
  lookingFor: string[];
  status: PresenceState;
  reputation: number;
  socialRank: SocialRank;
};

export type DailyGoal = {
  id: string;
  label: string;
  completed: boolean;
};

export type AdviceItem = {
  id: string;
  title: string;
  body: string;
  category: "energy" | "social" | "budget" | "discipline" | "wellbeing";
};

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type RelationshipRecord = {
  residentId: string;
  status: RelationshipStatus;
  score: number;
  quality: RelationshipQuality;
  influence: "positive" | "neutre" | "negative";
  lastInteractionAt: string;
  isFollowing: boolean;
};

export type InvitationRecord = {
  id: string;
  residentId: string;
  residentName: string;
  activitySlug: string;
  status: InvitationStatus;
  createdAt: string;
};

export type DatePlan = {
  id: string;
  residentId: string;
  residentName: string;
  venueKind: DateVenueKind;
  venueLabel: string;
  activitySlug: string;
  status: DatePlanStatus;
  scheduledMoment: string;
  note: string;
  bridgeToRealLife: string;
  createdAt: string;
};

export type LifeFeedItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type ConversationMessage = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: ConversationMessageKind;
};

export type Conversation = {
  id: string;
  peerId: string | null;
  title: string;
  subtitle: string;
  kind: ConversationKind;
  locationSlug: string | null;
  unreadCount: number;
  messages: ConversationMessage[];
};

export type PremiumTier = "monthly" | "yearly";

export type PremiumFeature =
  | "boost_x2"
  | "cosmetics"
  | "unlimited_dates"
  | "elite_social"
  | "realtime_sync"
  | "stats_insights";

export type MoneyTransfer = {
  id: string;
  kind: "sent" | "received" | "boost" | "cosmetic";
  residentId: string | null;
  residentName: string | null;
  amount: number;
  description: string;
  createdAt: string;
};

export type CosmeticItem = {
  id: string;
  name: string;
  kind: "badge" | "border" | "aura";
  color: string;
  price: number;
  requiresPremium: boolean;
};

export type BoostItem = {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  durationHours: number;
  price: number;
  activeUntil: string | null;
};

// ─── Monde vivant ─────────────────────────────────────────────────────────────

export type WorldPresenceMember = {
  userId: string;
  avatarName: string;
  locationSlug: string;
  action: import("@/lib/avatar-visual").AvatarAction;
  mood: number;
  onlineAt: string;
  // position sur la carte 2D (0-100 normalisé)
  posX: number;
  posY: number;
};

export type NpcState = {
  id: string;
  name: string;
  locationSlug: string;
  action: import("@/lib/avatar-visual").AvatarAction;
  mood: number;        // 0-100
  energy: number;      // 0-100
  hunger: number;      // 0-100 (baisse avec le temps)
  stress: number;      // 0-100
  hygiene: number;     // 0-100
  money: number;       // crédits
  xp: number;         // XP total cumulé
  level: number;      // floor(xp/100)+1
  reputation: number; // 0-100
  streak: number;     // jours consécutifs actifs
  lastTickAt: string;
  lastMessageAt: string | null;  // cooldown messages proactifs
  lastInviteAt: string | null;   // cooldown invitations
  posX: number;
  posY: number;
  presenceOnline: boolean;      // simulé : true = connecté
  lastOnlineAt: string | null;  // ISO — dernière connexion détectée
};

export type RoomInvite = {
  id: string;
  roomId: string;
  roomName: string;
  fromId: string;    // userId ou npcId
  fromName: string;
  toId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};

// ─── Work ─────────────────────────────────────────────────────────────────────

export type WorkSessionPhase = "idle" | "active" | "completed";

export type WorkSession = {
  phase: WorkSessionPhase;
  startedAt: string | null;
  durationSec: number;
  jobSlug: string;
  earnedCoins: number;
  earnedXp: number;
  earnedDiscipline: number;
  earnedReputation: number;
};

export type ShiftRecord = {
  id: string;
  jobSlug: string;
  jobName: string;
  earnedCoins: number;
  earnedXp: number;
  completedAt: string;
};

// ─── Rooms ────────────────────────────────────────────────────────────────────

export type StudyProgress = {
  moduleId: string;
  title: string;
  sessionsCompleted: number;
  level: number;
  xp: number;
  progressPct: number;
  updatedAt: string;
  completedAt: string | null;
};

export type StudySessionInput = {
  moduleId: string;
  title: string;
  totalSessions: number;
  xpPerSession: number;
};

export type RoomKind = "public" | "private" | "event" | "secret";

// Room éphémère — messages auto-supprimés après 2h, max 4 personnes
export type SecretRoom = {
  id: string;
  name: string;
  code: string;           // 6 chars
  ownerId: string;
  ownerName: string;
  memberIds: string[];
  maxMembers: number;     // max 4
  expiresAt: string;      // ISO — 2h après création
  createdAt: string;
  isActive: boolean;
};

export type SecretMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  expiresAt: string;      // même TTL que la room
};

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  code: string;           // 6 chars, pour rejoindre
  ownerId: string;        // userId du créateur
  ownerName: string;
  locationSlug: string;
  memberCount: number;
  maxMembers: number;
  description: string;
  createdAt: string;
  isActive: boolean;
};

export type RoomMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  kind: "message" | "system" | "emote";
};

export type RoomMember = {
  userId: string;
  avatarName: string;
  action: import("@/lib/avatar-visual").AvatarAction;
  joinedAt: string;
  isOnline: boolean;
};
