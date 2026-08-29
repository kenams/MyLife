import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useGameStore } from "@/stores/game-store";

/**
 * Guarded bootstrap for the persistent Kah QA profile.
 *
 * This route is intentionally unavailable in normal production builds. To use
 * it on a Vercel preview, set EXPO_PUBLIC_ENABLE_QA_ENTRY=true for that preview
 * environment. The resulting local session/avatar/progression are persisted by
 * the existing Zustand/AsyncStorage store, so a tester does not need to reload
 * the instant demo on every visit.
 *
 * Important: this is a local QA identity only. It does not grant Supabase or
 * server-side privileges and must never be used as an authorization mechanism.
 */
export default function KahQaBootstrap() {
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const loadTestAccount = useGameStore((state) => state.loadTestAccount);
  const [ready, setReady] = useState(false);

  const qaEntryEnabled = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_QA_ENTRY === "true";

  useEffect(() => {
    if (!qaEntryEnabled || !hasHydrated || ready) return;

    const state = useGameStore.getState();
    const alreadyKah = state.avatar?.displayName?.trim().toLowerCase() === "kah" && Boolean(state.session);

    // Never reset an existing Kah progression just because the bootstrap route
    // is revisited. Create the full-access profile only on the first entry.
    if (!alreadyKah) loadTestAccount("live");
    setReady(true);
  }, [hasHydrated, loadTestAccount, qaEntryEnabled, ready]);

  if (!qaEntryEnabled) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasHydrated || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#080808", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ActivityIndicator color="#FFD600" />
        <Text style={{ color: "#F5F2E8", fontWeight: "800" }}>Chargement du profil Kah…</Text>
      </View>
    );
  }

  return <Redirect href="/(app)/(tabs)/map" />;
}
