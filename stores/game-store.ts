import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  activities,
  applyActivityToStats,
  applyDecay,
  applyOutingToStats,
  appendFeed,
  appendNotification,
  buildAutomaticNotifications,
  createFeedFromAction,
  createInitialRuntime,
  createStatsFromAvatar,
  ensureLocalConversation,
  jobs,
  locations,
  normalizeStats,
  nowIso,
  resolveOutingResult,
  starterResidents,
  updateGoal,
  updateRelationshipScore
} from "@/lib/game-engine";
import { buildAdvice } from "@/lib/selectors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  AvatarProfile,
  Conversation,
  InvitationRecord,
  LifeActionId,
  NotificationItem,
  OutingConfig,
  UserSession
} from "@/lib/types";

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
  lifeFeed: ReturnType<typeof createInitialRuntime>["lifeFeed"];
  signIn: (email: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
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
  performOuting: (config: OutingConfig) => void;
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
    ...runtime
  };
}

function getStarterJob(slug: string) {
  return jobs.find((job) => job.slug === slug) ?? jobs[0];
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
    nextStats = normalizeStats({
      ...nextStats,
      money: nextStats.money + job.rewardCoins,
      energy: nextStats.energy - job.energyCost,
      hunger: nextStats.hunger - job.hungerCost,
      stress: nextStats.stress + job.stressCost,
      discipline: nextStats.discipline + job.disciplineReward,
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
      money: nextStats.money + 18,
      energy: nextStats.energy - 8,
      stress: nextStats.stress + 4,
      discipline: nextStats.discipline + 6,
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
          return {
            stats,
            advice: buildAdvice(stats),
            notifications: buildAutomaticNotifications(stats, state.notifications)
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

          return {
            currentLocationSlug: location.slug,
            currentNeighborhoodSlug: location.neighborhoodSlug,
            conversations: ensureLocalConversation(state.conversations, location.slug),
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

          return {
            conversations: state.conversations.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    unreadCount: 0,
                    messages: [
                      ...conversation.messages,
                      {
                        id: `msg-${Date.now()}`,
                        authorId: "self",
                        body: cleanBody,
                        createdAt,
                        read: true,
                        kind: "message"
                      }
                    ]
                  }
                : conversation
            ),
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
      claimDailyReward: () =>
        set((state) => {
          const today = new Date().toDateString();
          if (state.lastRewardAt && new Date(state.lastRewardAt).toDateString() === today) {
            return state;
          }

          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
          const streak =
            state.lastRewardAt && new Date(state.lastRewardAt).toDateString() === yesterday ? state.stats.streak + 1 : 1;
          const nextStats = normalizeStats({
            ...state.stats,
            money: state.stats.money + 32,
            mood: state.stats.mood + 8,
            motivation: state.stats.motivation + 6,
            streak,
            lastDecayAt: nowIso()
          });

          return {
            lastRewardAt: nowIso(),
            stats: nextStats,
            advice: buildAdvice(nextStats),
            notifications: appendNotification(state.notifications, {
              id: `daily-${Date.now()}`,
              kind: "reward",
              title: "Reward quotidienne recuperee",
              body: `Tu prends 32 credits et tu prolonges ta serie a ${streak} jour(s).`,
              createdAt: nowIso(),
              read: false
            })
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
