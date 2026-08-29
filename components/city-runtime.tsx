import { useEffect } from "react";

import { livingNpcsToMapPlayers } from "@/lib/city-simulation-map";
import { clearLocalCityPlayers, publishLocalCityPlayers } from "@/lib/local-city-map-bridge";
import { useGameStore } from "@/stores/game-store";

/**
 * Global Living City scheduler.
 *
 * The city is part of the game runtime, not a QA mode tied to the map screen.
 * It starts after Zustand hydration, advances immediately to account for time
 * spent offline, then progresses in coarse batches while the app is open.
 *
 * Important: one global timer only — never one timer/heartbeat per NPC.
 */
export function CityRuntime() {
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const runLivingCityTick = useGameStore((state) => state.runLivingCityTick);

  useEffect(() => {
    if (!hasHydrated) return;

    const publishMapSnapshot = () => {
      const state = useGameStore.getState();
      publishLocalCityPlayers(livingNpcsToMapPlayers(state.npcs ?? []));
    };

    // First tick reconciles elapsed/offline time using Living City's own
    // lastSimulatedAt state. No manual "activate city" action is required.
    runLivingCityTick();
    publishMapSnapshot();

    // Coarse simulation cadence. The Living City engine derives elapsed time
    // from timestamps, so this remains cheap and resilient to background tabs.
    const timer = setInterval(() => {
      runLivingCityTick();
      publishMapSnapshot();
    }, 30_000);

    return () => {
      clearInterval(timer);
      clearLocalCityPlayers();
    };
  }, [hasHydrated, runLivingCityTick]);

  return null;
}
