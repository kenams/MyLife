import { useEffect } from "react";

import { livingNpcsToMapPlayers } from "@/lib/city-simulation-map";
import { seedLivingCityNpcs } from "@/lib/living-city";
import { clearLocalCityPlayers, publishLocalCityPlayers } from "@/lib/local-city-map-bridge";
import { useGameStore } from "@/stores/game-store";

const CITY_TICK_MS = 30_000;
const IMMEDIATE_TICK_STALE_MS = 45_000;

/**
 * Global Living City scheduler.
 *
 * The city is part of the game runtime, not a QA mode tied to the map screen.
 * Zustand's rehydration already advances the city for offline time, so this
 * runtime must not blindly run a second simulation tick immediately after
 * hydration: Living City guarantees at least one simulated minute/event per
 * tick, which could duplicate feed items and notifications on cold start.
 *
 * Important: one global timer only — never one timer/heartbeat per NPC.
 */
export function CityRuntime() {
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const runLivingCityTick = useGameStore((state) => state.runLivingCityTick);

  useEffect(() => {
    if (!hasHydrated) return;

    // Older persisted stores can contain the pre-Living-City NPC sample
    // (for example ~20 residents). Repair that state in place without wiping
    // the player's existing NPC history/relations: keep every resident we
    // already know, then append only the missing deterministic city residents
    // for the current preset.
    const hydrated = useGameStore.getState();
    const preset = hydrated.livingCity?.preset ?? "NORMAL";
    const expectedResidents = seedLivingCityNpcs(preset);
    if ((hydrated.npcs?.length ?? 0) < expectedResidents.length) {
      const existingIds = new Set((hydrated.npcs ?? []).map((npc) => npc.id));
      const repaired = [
        ...(hydrated.npcs ?? []),
        ...expectedResidents.filter((npc) => !existingIds.has(npc.id)),
      ].slice(0, expectedResidents.length);
      useGameStore.setState({ npcs: repaired });
    }

    const publishMapSnapshot = () => {
      const state = useGameStore.getState();
      publishLocalCityPlayers(livingNpcsToMapPlayers(state.npcs ?? []));
    };

    // Rehydration normally already reconciles offline elapsed time. Only run
    // immediately when no simulation timestamp exists or the state is stale.
    const lastSimulatedAt = useGameStore.getState().livingCity?.lastSimulatedAt;
    const lastSimulatedMs = lastSimulatedAt ? new Date(lastSimulatedAt).getTime() : Number.NaN;
    const isStale = !Number.isFinite(lastSimulatedMs) || Date.now() - lastSimulatedMs > IMMEDIATE_TICK_STALE_MS;

    if (isStale) runLivingCityTick();
    publishMapSnapshot();

    // Coarse simulation cadence. The engine derives elapsed time from its own
    // timestamp and remains bounded; background tabs therefore do not spawn
    // per-NPC timers or heartbeats.
    const timer = setInterval(() => {
      runLivingCityTick();
      publishMapSnapshot();
    }, CITY_TICK_MS);

    return () => {
      clearInterval(timer);
      clearLocalCityPlayers();
    };
  }, [hasHydrated, runLivingCityTick]);

  return null;
}
