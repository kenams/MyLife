import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { registerPushTokenToSupabase } from "@/lib/supabase-sync";
import { useGameStore } from "@/stores/game-store";

async function getExpoPushToken() {
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

  const result = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return result.data;
}

export function usePushTokenRegistration() {
  const session = useGameStore((s) => s.session);
  const supabaseAvatarId = useGameStore((s) => s.supabaseAvatarId);
  const registeredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isSupabaseConfigured || !supabase) return;
    if (!session || session.provider !== "supabase" || !supabaseAvatarId) return;

    const avatarId = supabaseAvatarId;
    const key = `${session.email}:${avatarId}`;
    if (registeredKeyRef.current === key) return;

    let cancelled = false;

    async function register() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      const token = await getExpoPushToken();
      const { data } = await supabase!.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      const result = await registerPushTokenToSupabase(
        userId,
        avatarId,
        token,
        Platform.OS
      );

      if (result.ok) {
        registeredKeyRef.current = key;
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, [session?.email, session?.provider, supabaseAvatarId]);
}
