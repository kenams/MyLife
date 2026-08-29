/**
 * Feature flags + kill switches.
 * Chaque nouvelle mécanique de la V2 arrive derrière un flag : on peut la couper
 * instantanément (table `feature_flags`, propagation realtime) sans redéployer.
 * Si la table n'existe pas encore ou que le réseau tombe, on retombe sur DEFAULTS.
 */

import { supabase } from "./supabase";

export type FlagCode =
  | "daily_hub"
  | "gain_toast"
  | "season_hub"
  | "flash_events"
  | "crew_life"
  | "rare_events";

const DEFAULTS: Record<FlagCode, boolean> = {
  daily_hub: true,
  gain_toast: true,
  season_hub: true,
  flash_events: true,
  crew_life: false,
  rare_events: false,
};

let cache: Partial<Record<FlagCode, boolean>> = {};
let loaded = false;

export function flagsLoaded() {
  return loaded;
}

export async function loadFlags(): Promise<void> {
  if (!supabase) {
    loaded = true;
    return;
  }
  try {
    const { data, error } = await supabase.from("feature_flags").select("code,enabled");
    if (!error && data) {
      const next: Partial<Record<FlagCode, boolean>> = {};
      for (const row of data as { code: string; enabled: boolean }[]) {
        next[row.code as FlagCode] = row.enabled;
      }
      cache = next;
    }
  } catch {
    // table absente / hors ligne → on garde DEFAULTS
  }
  loaded = true;
}

export function isEnabled(code: FlagCode): boolean {
  return cache[code] ?? DEFAULTS[code];
}

export function subscribeFlags(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("feature_flags")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "feature_flags" },
      async () => {
        await loadFlags();
        onChange();
      },
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
