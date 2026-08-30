import type { MapPlayer } from "@/lib/life-map";
import type { LivingCityState } from "@/lib/living-city";

/**
 * Hook QA non sensible pour les tests E2E (Playwright).
 *
 * Expose `window.__mylifeDebug` UNIQUEMENT en dev ou quand le flag QA est armé.
 * Ne contient jamais : email, token, session, clé API. Uniquement des compteurs
 * et un échantillon de positions PNJ pour vérifier que la ville bouge.
 */

export type MylifeDebugSnapshot = {
  updatedAt: number;
  tick: number;
  simulatedAt: string | null;
  realCount: number;
  npcCount: number;
  materialized: number;
  eventCount: number;
  activityHistogram: Record<string, number>;
  travelingCount: number;
  positions: { id: string; lat: number; lng: number; act: string }[];
  /**
   * État de progression DU JOUEUR (ses propres données, non sensibles) — sert
   * aux tests de parité cross-device. Aucun email / token / session ici.
   */
  player: {
    authProvider: string | null;
    hasSupabaseSession: boolean;
    username: string | null;
    level: number;
    xp: number;
    wory: number;
    crewTag: string | null;
    unreadNotifications: number;
    isQa: boolean;
  } | null;
};

const ENABLED =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_ENABLE_QA_ENTRY === "true");

function scrubActivity(label: string | null | undefined): string {
  if (!label) return "idle";
  // garde le mot-clé, retire les emojis / accents décoratifs
  return label.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/).slice(0, 3).join(" ") || "idle";
}

export type DebugPlayerInput = {
  authProvider: string | null;
  hasSupabaseSession: boolean;
  username: string | null;
  level: number;
  xp: number;
  wory: number;
  crewTag: string | null;
  unreadNotifications: number;
  isQa: boolean;
};

export function publishMylifeDebug(input: {
  players: MapPlayer[];
  livingCity: LivingCityState | null | undefined;
  realCount: number;
  npcCount: number;
  player?: DebugPlayerInput | null;
}) {
  if (!ENABLED || typeof window === "undefined") return;
  const npcs = input.players.filter((p) => p.is_npc);
  const histogram: Record<string, number> = {};
  let traveling = 0;
  for (const p of npcs) {
    const key = scrubActivity(p.last_action);
    histogram[key] = (histogram[key] ?? 0) + 1;
    if (/trajet|transit|commut/i.test(p.last_action ?? "")) traveling += 1;
  }
  const snapshot: MylifeDebugSnapshot = {
    updatedAt: Date.now(),
    tick: input.livingCity?.tick ?? 0,
    simulatedAt: input.livingCity?.lastSimulatedAt ?? null,
    realCount: input.realCount,
    npcCount: input.npcCount,
    materialized: npcs.length,
    eventCount: input.livingCity?.events?.length ?? 0,
    activityHistogram: histogram,
    travelingCount: traveling,
    positions: npcs.slice(0, 60).map((p) => ({
      id: p.id,
      lat: Math.round(p.lat * 1e5) / 1e5,
      lng: Math.round(p.lng * 1e5) / 1e5,
      act: scrubActivity(p.last_action),
    })),
    player: input.player ?? null,
  };
  const w = window as unknown as {
    __mylifeDebug?: MylifeDebugSnapshot & { history: number[] };
  };
  const history = (w.__mylifeDebug?.history ?? []).concat(snapshot.updatedAt).slice(-40);
  w.__mylifeDebug = { ...snapshot, history };
}
