import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useGameStore } from "@/stores/game-store";

// Les notifications push ne sont pas supportées sur le web
const IS_WEB = Platform.OS === "web";

if (!IS_WEB) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true
    })
  });
}

async function requestPermissions(): Promise<boolean> {
  if (IS_WEB) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function scheduleLocalNotification(title: string, body: string, delaySeconds = 0) {
  if (IS_WEB) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger:
      delaySeconds > 0
        ? { seconds: delaySeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL }
        : null
  });
}

async function scheduleDailyReminder() {
  if (IS_WEB) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if ((notif.content.data as Record<string, unknown>)?.mylifeDaily) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "MyLife — Ta journée t'attend",
      body: "Vérifie tes stats, maintiens ton streak et avance sur tes objectifs.",
      data: { mylifeDaily: true }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0
    }
  });
}

async function scheduleStreakReminder(streak: number) {
  if (IS_WEB || streak < 2) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.some((n) => (n.content.data as Record<string, unknown>)?.mylifeStreak)) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Série ${streak} jours — Ne la casse pas`,
      body: "Connecte-toi et claim ta reward du jour avant minuit.",
      data: { mylifeStreak: true }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 30
    }
  });
}

const CRITICAL_THRESHOLD = 18;
const WARN_THRESHOLD = 30;

export function useLocalNotifications() {
  const stats       = useGameStore((s) => s.stats);
  const session     = useGameStore((s) => s.session);
  const invitations = useGameStore((s) => s.invitations);
  const dailyEvent  = useGameStore((s) => s.dailyEvent);
  const hasPermission    = useRef(false);
  const lastAlertRef     = useRef<Record<string, number>>({});
  const dailyScheduled   = useRef(false);

  useEffect(() => {
    if (IS_WEB) return;
    requestPermissions().then((granted) => {
      hasPermission.current = granted;
      if (granted && session && !dailyScheduled.current) {
        dailyScheduled.current = true;
        void scheduleDailyReminder();
      }
    });
  }, [session]);

  useEffect(() => {
    if (IS_WEB || !hasPermission.current) return;
    if (stats.streak >= 2) void scheduleStreakReminder(stats.streak);
  }, [stats.streak]);

  // Invitation en attente
  useEffect(() => {
    if (IS_WEB || !hasPermission.current) return;
    const pending = invitations.filter((inv) => inv.status === "pending");
    if (pending.length > 0) {
      const inv = pending[0];
      const key = `invite-${inv.id}`;
      const now = Date.now();
      if (now - (lastAlertRef.current[key] ?? 0) > 60 * 60 * 1000) {
        lastAlertRef.current[key] = now;
        void scheduleLocalNotification(
          `${inv.residentName} t'invite`,
          "Une invitation t'attend dans l'onglet Social.",
          2
        );
      }
    }
  }, [invitations]);

  // Événement du jour non résolu
  useEffect(() => {
    if (IS_WEB || !hasPermission.current) return;
    if (dailyEvent && !dailyEvent.resolved) {
      const key = `event-${dailyEvent.id}`;
      const now = Date.now();
      if (now - (lastAlertRef.current[key] ?? 0) > 4 * 60 * 60 * 1000) {
        lastAlertRef.current[key] = now;
        void scheduleLocalNotification(
          `Événement : ${dailyEvent.title}`,
          "Un choix t'attend dans MyLife. L'ignorer a des conséquences.",
          5
        );
      }
    }
  }, [dailyEvent]);

  useEffect(() => {
    if (IS_WEB || !hasPermission.current) return;

    const now = Date.now();
    const COOLDOWN_MS = 30 * 60 * 1000;
    const canAlert = (key: string) => now - (lastAlertRef.current[key] ?? 0) > COOLDOWN_MS;
    const alert = (key: string, title: string, body: string, delay = 0) => {
      if (!canAlert(key)) return;
      lastAlertRef.current[key] = now;
      void scheduleLocalNotification(title, body, delay);
    };

    // Besoins vitaux
    if (stats.hunger < CRITICAL_THRESHOLD)        alert("hunger-critical",     "Faim critique",               "Ton avatar a vraiment besoin de manger.");
    else if (stats.hunger < WARN_THRESHOLD)        alert("hunger-low",          "Faim en baisse",              "Pense à manger bientôt.");
    if (stats.energy < CRITICAL_THRESHOLD)         alert("energy-critical",     "Épuisement détecté",          "Dors d'abord.");
    else if (stats.energy < WARN_THRESHOLD)        alert("energy-low",          "Énergie en baisse",           "Une sieste ou une pause active.");
    if (stats.hydration < CRITICAL_THRESHOLD)      alert("hydration-critical",  "Déshydratation",              "Bois quelque chose maintenant.");
    if (stats.stress > 82)                         alert("stress-high",         "Stress au maximum",           "Marche, dors ou fais une pause.");
    else if (stats.stress > 65)                    alert("stress-elevated",     "Stress élevé",                "Médite ou marche 10 min.");
    if (stats.sociability < CRITICAL_THRESHOLD)    alert("social-critical",     "Isolement social",            "Un message ou une sortie courte suffit.");
    if (stats.hygiene < CRITICAL_THRESHOLD)        alert("hygiene-low",         "Hygiène basse",               "Une douche change tout.");
    if (stats.mentalStability === "sature")        alert("mental-sature",       "Mental saturé",               "Priorité : repos et bases.");
    if (stats.motivation < CRITICAL_THRESHOLD)     alert("motivation-low",      "Motivation en chute",         "Reprends une petite action simple.");
    if (stats.fitness < CRITICAL_THRESHOLD)        alert("fitness-low",         "Forme physique en berne",     "Une marche ou 20 min de sport.");
    if (stats.health < 30)                         alert("health-low",          "Santé dégradée",              "Mange sainement, dors suffisamment.");
    if (stats.discipline < CRITICAL_THRESHOLD)     alert("discipline-low",      "Discipline en chute",         "Reprends une tâche simple maintenant.");
    // Finances
    if (stats.money < 30)                          alert("money-low",           "Budget critique",             "Moins de 30 crédits. Travaille dès que possible.");
    else if (stats.money < 60)                     alert("money-moderate",      "Budget limité",               "60 crédits — pense à planifier tes dépenses.");
    // Streaks & momentum
    if (stats.streak >= 30)                        alert("streak-30",           "30 jours — Mode de vie solide","Un mois complet. Tu es dans une catégorie à part.", 5);
    else if (stats.streak >= 14)                   alert("streak-14",           "14 jours consécutifs",        "Deux semaines. Le multiplicateur est au maximum.", 5);
    else if (stats.streak >= 7)                    alert("streak-7",            `Série ${stats.streak} jours`, "Tu es locked-in.", 3);
    else if (stats.streak >= 3)                    alert("streak-3",            "3 jours de suite",            "La routine se met en place.", 3);
    // Objectifs imminents
    if (stats.socialRankScore >= 80)               alert("rank-high",           "Rang social élevé",           "Tu attires maintenant des profils de qualité.");
    if (stats.attractiveness >= 75)                alert("attractiveness-high", "Image au sommet",             "Cohérence, forme et hygiène font leur effet.");
  }, [stats]);
}
