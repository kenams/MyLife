import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { CityRuntime } from "@/components/city-runtime";
import { DuskOverlay } from "@/components/dusk-overlay";
import { useAuthListener } from "@/hooks/use-auth-listener";
import { hasConsented } from "./(auth)/consent";
import { isAgeVerified } from "./(auth)/age-check";
import { useGameStore } from "@/stores/game-store";

function AuthGate() {
  useAuthListener();
  const avatarName   = useGameStore((s) => s.avatar?.displayName?.trim().toLowerCase() ?? "");
  const sessionEmail = useGameStore((s) => s.session?.email?.trim().toLowerCase() ?? "");
  const resetAll     = useGameStore((s) => s.resetAll);

  useEffect(() => {
    const shouldPurgeKenanProfile =
      avatarName === "kenan" || sessionEmail === "kenan" || sessionEmail.startsWith("kenan@");
    if (!shouldPurgeKenanProfile) return;
    resetAll();
    router.replace("/(auth)/welcome");
  }, [avatarName, resetAll, sessionEmail]);

  // Vérif légale au premier lancement
  useEffect(() => {
    async function checkLegal() {
      try {
        const ageOk     = await isAgeVerified();
        const consentOk = await hasConsented();
        if (!ageOk) {
          router.replace("/(auth)/age-check");
        } else if (!consentOk) {
          router.replace("/(auth)/consent");
        }
      } catch {
        // AsyncStorage indispo au cold start — on laisse l'app continuer
      }
    }
    checkLegal();
  }, []);

  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AuthGate />
      <CityRuntime />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      <DuskOverlay />
    </QueryClientProvider>
  );
}
