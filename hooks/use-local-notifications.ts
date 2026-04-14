import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";

import { useGameStore } from "@/stores/game-store";

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function scheduleLocalNotification(title: string, body: string, delaySeconds = 0) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: delaySeconds > 0 ? { seconds: delaySeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL } : null
  });
}

const CRITICAL_THRESHOLD = 18;
const WARN_THRESHOLD = 30;

export function useLocalNotifications() {
  const stats = useGameStore((state) => state.stats);
  const hasPermission = useRef(false);
  const lastAlertRef = useRef<Record<string, number>>({});

  useEffect(() => {
    requestPermissions().then((granted) => {
      hasPermission.current = granted;
    });
  }, []);

  useEffect(() => {
    if (!hasPermission.current) return;

    const now = Date.now();
    const COOLDOWN_MS = 30 * 60 * 1000; // 30 min per alert type

    const canAlert = (key: string) => {
      const last = lastAlertRef.current[key] ?? 0;
      return now - last > COOLDOWN_MS;
    };

    const alert = (key: string, title: string, body: string) => {
      if (!canAlert(key)) return;
      lastAlertRef.current[key] = now;
      scheduleLocalNotification(title, body);
    };

    if (stats.hunger < CRITICAL_THRESHOLD) {
      alert("hunger-critical", "Faim critique", "Ton avatar a vraiment besoin de manger. Maintenant.");
    } else if (stats.hunger < WARN_THRESHOLD) {
      alert("hunger-low", "Faim en baisse", "Pense a manger bientot — l'humeur et l'energie suivront.");
    }

    if (stats.energy < CRITICAL_THRESHOLD) {
      alert("energy-critical", "Epuisement detecte", "Le corps ne peut plus fonctionner correctement. Dors d'abord.");
    }

    if (stats.stress > 82) {
      alert("stress-high", "Stress au maximum", "Ton avatar est en surchauffe. Marche, dors, ou fais une pause maintenant.");
    }

    if (stats.sociability < CRITICAL_THRESHOLD) {
      alert("social-critical", "Isolement social", "Un message ou une sortie courte suffirait a relancer la dynamique.");
    }

    if (stats.hygiene < CRITICAL_THRESHOLD) {
      alert("hygiene-low", "Hygiene basse", "L'image et la confiance en patissent. Une douche rapide change tout.");
    }

    if (stats.mentalStability === "sature") {
      alert("mental-sature", "Mental saturé", "Ton mode de vie accumule trop de pression. Priorite : repos et bases.");
    }
  }, [stats]);
}
