import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushTokenToSupabase } from "@/lib/supabase-sync";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerPushToken(
  userId: string,
  avatarId: string
): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MyLife",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8b7cff",
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await registerPushTokenToSupabase(userId, avatarId, token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}

export async function scheduleStreakReminder(streakCount: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync("streak-reminder").catch(() => {});

  const title = streakCount > 0 ? `🔥 Streak ${streakCount} jours !` : "💧 Reprends ton streak";
  const body  = streakCount > 0
    ? "Ne laisse pas tomber ta série, joue maintenant !"
    : "Tu peux recommencer ta série dès aujourd'hui !";

  // Rappel à 20h chaque jour
  await Notifications.scheduleNotificationAsync({
    identifier: "streak-reminder",
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

export async function scheduleHungerReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync("hunger-reminder").catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: "hunger-reminder",
    content: {
      title: "🍽️ Tu as faim !",
      body: "Tes stats baissent — mange quelque chose maintenant.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 4 * 3600,
      repeats: true,
    },
  });
}

export async function sendLocalNotification(
  title: string,
  body: string,
  delaySeconds = 0
): Promise<void> {
  if (delaySeconds > 0) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        repeats: false,
      },
    });
  } else {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  }
}

export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
