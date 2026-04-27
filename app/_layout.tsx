import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { DuskOverlay } from "@/components/dusk-overlay";
import { useAuthListener } from "@/hooks/use-auth-listener";
import { useGameStore } from "@/stores/game-store";

function AuthGate() {
  useAuthListener();
  const avatarName = useGameStore((s) => s.avatar?.displayName?.trim().toLowerCase() ?? "");
  const sessionEmail = useGameStore((s) => s.session?.email?.trim().toLowerCase() ?? "");
  const resetAll = useGameStore((s) => s.resetAll);

  useEffect(() => {
    const shouldPurgeKenanProfile =
      avatarName === "kenan" || sessionEmail === "kenan" || sessionEmail.startsWith("kenan@");
    if (!shouldPurgeKenanProfile) return;

    resetAll();
    router.replace("/(auth)/welcome");
  }, [avatarName, resetAll, sessionEmail]);

  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      <DuskOverlay />
    </QueryClientProvider>
  );
}
