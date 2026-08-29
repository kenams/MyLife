import { Redirect } from "expo-router";

import { useGameStore } from "@/stores/game-store";

export default function IndexScreen() {
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const session = useGameStore((state) => state.session);
  const avatar = useGameStore((state) => state.avatar);

  if (!hasHydrated) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!avatar) {
    return <Redirect href="/(auth)/avatar" />;
  }

  // MyLife opens on the living city itself. Home remains a secondary tab.
  return <Redirect href="/(app)/(tabs)/map" />;
}
