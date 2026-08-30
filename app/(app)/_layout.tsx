import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, Stack, useSegments } from "expo-router";

import { useLocalNotifications } from "@/hooks/use-local-notifications";
import { usePushTokenRegistration } from "@/hooks/use-push-token-registration";
import { useSocialNotifications } from "@/hooks/use-social-notifications";
import { GainToast } from "@/components/gain-toast";
import { useFlags } from "@/hooks/use-flags";
import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/stores/game-store";

function NotificationWatcher() {
  useLocalNotifications();
  usePushTokenRegistration();
  useSocialNotifications();
  return null;
}

export default function AppLayout() {
  const { flag } = useFlags();
  const segments = useSegments();
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasServerSession, setHasServerSession] = useState(false);

  const onCrewsRoute = segments.includes("crews" as never);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setHasServerSession(false);
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasServerSession(Boolean(data.session));
      setAuthChecked(true);
    }).catch(() => {
      if (!active) return;
      setHasServerSession(false);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasServerSession(Boolean(session));
      setAuthChecked(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Crews is a level-2 city unlock. Do not render a server-backed screen that
  // the player cannot use yet. A direct/deep link is sent back to the Map.
  if (onCrewsRoute && playerLevel < 2) {
    return <Redirect href="/(app)/(tabs)/map" />;
  }

  // Crew membership/creation is persisted in Supabase and its RPCs require a
  // real authenticated user. Local QA/demo identities must never be treated as
  // server authorization, so send them through the real sign-in flow instead
  // of showing buttons that can only fail silently.
  if (onCrewsRoute && authChecked && !hasServerSession) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NotificationWatcher />
      <Stack screenOptions={{ headerShown: false }} />
      {flag("gain_toast") && <GainToast />}
    </View>
  );
}
