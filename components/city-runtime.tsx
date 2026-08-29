import { useEffect } from "react";

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

    // First tick reconciles elapsed/offline time using Living City's own
    // lastSimulatedAt state. No manual "activate city" action is required.
    runLivingCityTick();

    // Coarse simulation cadence. The Living City engine derives elapsed time
    // from timestamps, so this remains cheap and resilient to background tabs.
    const timer = setInterval(() => {
      runLivingCityTick();
    }, 30_000);

    return () => clearInterval(timer);
  }, [hasHydrated, runLivingCityTick]);

  return null;
}
