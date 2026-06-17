import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase";

export function setupNotificationHandler(): void {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (!supabase) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  await supabase.from("push_tokens").upsert(
    { user_id: userId, token, platform: Platform.OS },
    { onConflict: "user_id" },
  );
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}
